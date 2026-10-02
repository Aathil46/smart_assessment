import json
import re
import sys
import olefile

MAX_LENGTH = 100000


def clean_word_text(text: str) -> str:
    if not text:
        return ""
    # Word special control characters
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\x07", "\t")  # cell mark
    text = text.replace("\x0b", "\n")  # line break
    text = text.replace("\x0c", "\n\n")  # page break
    # Strip unprintable control characters except \n and \t
    text = re.sub(r"[\x00-\x08\x0e-\x1f]", "", text)
    # Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_rtf_text(content: bytes) -> str:
    """Extract plain text from RTF content."""
    try:
        text = content.decode("utf-8", errors="ignore")
    except Exception:
        text = content.decode("latin1", errors="ignore")

    # Remove RTF destinations / groups like font tables, color tables
    text = re.sub(r"\{\\\*(?:\\?\w+)+[^}]*\}", "", text)
    text = re.sub(r"\{\\(?:fonttbl|colortbl|stylesheet|info|pict|header|footer)[^}]*\}", "", text)
    # Convert escaped hex \'xx
    text = re.sub(r"\\\'([0-9a-fA-F]{2})", lambda m: bytes.fromhex(m.group(1)).decode("latin1", errors="ignore"), text)
    # Replace common RTF controls
    text = text.replace(r"\par", "\n").replace(r"\line", "\n").replace(r"\tab", "\t")
    # Remove remaining RTF control words
    text = re.sub(r"\\[a-zA-Z]+-?\d* ?", "", text)
    # Remove remaining braces
    text = text.replace("{", "").replace("}", "")
    return clean_word_text(text)


def extract_from_fib_and_table(word_doc: bytes, table_data: bytes) -> str:
    """Extract text from Word 97-2004 FIB and CLX/Piece Table."""
    if len(word_doc) < 426:
        return ""

    fc_plcf_pcd = int.from_bytes(word_doc[418:422], byteorder="little")
    lcb_plcf_pcd = int.from_bytes(word_doc[422:426], byteorder="little")

    if lcb_plcf_pcd <= 0 or fc_plcf_pcd + lcb_plcf_pcd > len(table_data):
        return ""

    clx_data = table_data[fc_plcf_pcd : fc_plcf_pcd + lcb_plcf_pcd]
    idx = 0

    # Skip any Prc structures (clxt == 0x01)
    while idx < len(clx_data) and clx_data[idx] == 0x01:
        if idx + 3 > len(clx_data):
            return ""
        cb = int.from_bytes(clx_data[idx + 1 : idx + 3], byteorder="little")
        idx += 3 + cb

    # Now we should be at Plcfpcd (clxt == 0x02)
    if idx >= len(clx_data) or clx_data[idx] != 0x02:
        return ""

    idx += 1
    if idx + 4 > len(clx_data):
        return ""

    lcb = int.from_bytes(clx_data[idx : idx + 4], byteorder="little")
    idx += 4

    if lcb <= 4 or idx + lcb > len(clx_data):
        return ""

    # Each piece is (CP: 4 bytes, PCD: 8 bytes). Total: (n+1)*4 + n*8 = 4 + 12*n
    n = (lcb - 4) // 12
    if n <= 0:
        return ""

    # Read Character Positions (n + 1 unsigned ints)
    cps = []
    for i in range(n + 1):
        cp = int.from_bytes(clx_data[idx + i * 4 : idx + (i + 1) * 4], byteorder="little")
        cps.append(cp)

    pcd_start = idx + (n + 1) * 4
    extracted_parts = []

    for i in range(n):
        pcd_offset = pcd_start + i * 8
        if pcd_offset + 8 > len(clx_data):
            break

        # bytes 2..6 of PCD is fcValue
        fc_value = int.from_bytes(clx_data[pcd_offset + 2 : pcd_offset + 6], byteorder="little")
        f_compressed = bool(fc_value & 0x40000000)
        fc = fc_value & ~0x40000000

        cp_len = cps[i + 1] - cps[i]
        if cp_len <= 0:
            continue

        if f_compressed:
            byte_offset = fc // 2
            byte_len = cp_len
            if byte_offset + byte_len <= len(word_doc):
                part = word_doc[byte_offset : byte_offset + byte_len].decode("cp1252", errors="ignore")
                extracted_parts.append(part)
        else:
            byte_offset = fc
            byte_len = cp_len * 2
            if byte_offset + byte_len <= len(word_doc):
                part = word_doc[byte_offset : byte_offset + byte_len].decode("utf-16le", errors="ignore")
                extracted_parts.append(part)

    return clean_word_text("".join(extracted_parts))


def fallback_stream_extract(word_doc: bytes) -> str:
    """Fallback: scan WordDocument binary stream for readable text blocks."""
    start_offset = min(512, len(word_doc))
    content = word_doc[start_offset:]

    ascii_matches = re.findall(rb"[\x20-\x7E\r\n\t]{4,}", content)
    ascii_text = "\n".join(m.decode("ascii", errors="ignore") for m in ascii_matches)

    utf16_matches = re.findall(rb"(?:[\x20-\x7E]\x00){4,}", content)
    utf16_text = "\n".join(m.decode("utf-16le", errors="ignore") for m in utf16_matches)

    best_text = utf16_text if len(utf16_text) > len(ascii_text) else ascii_text
    return clean_word_text(best_text)


def extract_doc(path: str) -> dict:
    with open(path, "rb") as f:
        header = f.read(16)

    # Check for .docx file mistakenly passed as .doc
    if header.startswith(b"PK\x03\x04"):
        raise ValueError(
            "This file appears to be a modern .docx (ZIP archive) rather than a legacy .doc binary file. "
            "Please provide a genuine .doc file or convert it."
        )

    # Check for RTF saved as .doc
    if header.startswith(b"{\x5crtf"):
        with open(path, "rb") as f:
            full_bytes = f.read()
        text = extract_rtf_text(full_bytes)
        chunks = [{"page": 1, "text": text[:MAX_LENGTH]}] if text else []
        return {
            "pageCount": 1,
            "usedPages": 1,
            "chunks": chunks,
            "hasEnoughText": len(text) > 100,
            "text": text[:MAX_LENGTH],
        }

    # Verify OLE Compound File format
    if not olefile.isOleFile(path):
        raise ValueError("Invalid .doc file: Not a valid OLE Compound Binary Document or RTF.")

    ole = olefile.OleFileIO(path)
    try:
        if not ole.exists("WordDocument"):
            raise ValueError("Invalid Word Document: 'WordDocument' stream not found.")

        word_doc = ole.openstream("WordDocument").read()
        if len(word_doc) < 512:
            raise ValueError("WordDocument stream is corrupted or truncated.")

        flags = int.from_bytes(word_doc[10:12], byteorder="little")
        table_name = "1Table" if (flags & 0x0200) else "0Table"

        table_data = b""
        if ole.exists(table_name):
            table_data = ole.openstream(table_name).read()

        text = ""
        if table_data:
            text = extract_from_fib_and_table(word_doc, table_data)

        if not text:
            text = fallback_stream_extract(word_doc)

        text = text[:MAX_LENGTH]
        chunks = [{"page": 1, "text": text}] if text else []

        return {
            "pageCount": 1,
            "usedPages": 1,
            "chunks": chunks,
            "hasEnoughText": len(text) > 100,
            "text": text,
        }
    finally:
        ole.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing file path"}))
        sys.exit(1)

    try:
        result = extract_doc(sys.argv[1])
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
