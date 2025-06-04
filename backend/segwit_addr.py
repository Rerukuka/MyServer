# segwit_addr.py

CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

def bech32_polymod(values):
    """Internal function that computes the Bech32 checksum."""
    GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
    chk = 1
    for v in values:
        b = (chk >> 25)
        chk = (chk & 0x1ffffff) << 5 ^ v
        for i in range(5):
            chk ^= GEN[i] if ((b >> i) & 1) else 0
    return chk

def bech32_hrp_expand(hrp):
    """Expand the HRP for Bech32 checksum computation."""
    return [ord(x) >> 5 for x in hrp] + [0] + [ord(x) & 31 for x in hrp]

def verify_checksum(hrp, data):
    return bech32_polymod(bech32_hrp_expand(hrp) + data) == 1

def decode(hrp, addr):
    """Decode a Bech32 address."""
    if any(ord(x) < 33 or ord(x) > 126 for x in addr):
        return (None, None)
    addr = addr.lower()
    if addr[:len(hrp)+1] != hrp + '1':
        return (None, None)
    data = []
    for c in addr[len(hrp)+1:]:
        if c not in CHARSET:
            return (None, None)
        data.append(CHARSET.find(c))
    if not verify_checksum(hrp, data):
        return (None, None)
    return (data[0], convertbits(data[1:-6], 5, 8, False))

def convertbits(data, frombits, tobits, pad=True):
    """General power-of-2 base conversion."""
    acc = 0
    bits = 0
    ret = []
    maxv = (1 << tobits) - 1
    for value in data:
        if value < 0 or value >> frombits:
            return None
        acc = (acc << frombits) | value
        bits += frombits
        while bits >= tobits:
            bits -= tobits
            ret.append((acc >> bits) & maxv)
    if pad:
        if bits:
            ret.append((acc << (tobits - bits)) & maxv)
    elif bits >= frombits or ((acc << (tobits - bits)) & maxv):
        return None
    return ret
