// qrcode-generator's default byte encoder truncates each UTF-16 code unit to its
// low byte (Latin-1-ish), which mangles German umlauts (ä/ö/ü/ß) and anything else
// outside ASCII — jsQR decodes byte-mode data as UTF-8, so the two disagree and
// scanning silently fails. Switch the library's global encoder to its built-in
// UTF-8 mode once, before any QR code is generated. Import this module (for its
// side effect) in every file that calls qrcode(...) to generate a code.
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
