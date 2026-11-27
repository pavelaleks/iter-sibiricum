import re
def typo(s):
    if not isinstance(s,str) or "'" not in s: return s
    s=re.sub(r"(^|[\s(\[“/—–-])'", r"\1‘", s)
    return s.replace("'", "’")
