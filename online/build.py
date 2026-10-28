"""Erzeugt online.html aus index.html + online-src.js + online.css. index.html wird dabei nicht verändert."""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
s = (root / "index.html").read_text()
js = (root / "online" / "online-src.js").read_text()
css = (root / "online" / "online.css").read_text()
def rep(a, b):
    global s
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)
rep('<title>Flugduell</title>', '<title>Flugduell Online</title>')
rep('<meta name="apple-mobile-web-app-title" content="Flugduell">', '<meta name="apple-mobile-web-app-title" content="Flugduell Online">')
rep('<link rel="manifest" href="manifest.json">', '<link rel="manifest" href="manifest-online.json">')
rep('const KEY="flugduell-v3"', 'const KEY="flugduell-online-shell"')
rep('</style>', css + '</style>')
i = s.index('\nload();\n{const v=S.view'); j = s.index('</script>', i)
s = s[:i] + "\n" + js + "\n" + s[j:]
(root / "online.html").write_text(s)
print("online.html erzeugt,", len(s), "Zeichen")
