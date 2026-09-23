import re, os

files = [
    r'D:/AI/workbuddy/2026-08-27-11-26-07/home-prototype-v8.html',
    r'D:/AI/workbuddy/2026-08-27-11-26-07/home-prototype-v7.html',
    r'D:/AI/workbuddy/2026-08-27-11-26-07/training-pkg/training-management-share/public/index.html',
]
# 只匹配真正的 emoji 区段，排除中文/标点
EMOJI = re.compile(
    '[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F2FF\u2b00-\u2bff\ufe0f]'
)
for f in files:
    if not os.path.exists(f):
        print('MISSING', f); continue
    txt = open(f, encoding='utf-8').read()
    hits = EMOJI.findall(txt)
    from collections import Counter
    c = Counter(hits)
    print('=== %s' % os.path.basename(f))
    print('  total emoji chars:', len(hits))
    print('  ', ' '.join('%s×%d' % (k, v) for k, v in c.most_common(40)))
    print()
