from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import subprocess,tempfile
root=Path(__file__).resolve().parents[1]/'public'
errors=[];count=0
class Parser(HTMLParser):
    def __init__(self):
        super().__init__();self.links=[];self.scripts=[];self.current=None
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag in ['a','link','script','img','iframe']:
            v=a.get('href') or a.get('src')
            if v:self.links.append(v)
        if tag=='script' and not a.get('src') and a.get('type','') not in ['application/json','application/ld+json']:
            self.current=''
    def handle_data(self,data):
        if self.current is not None:self.current+=data
    def handle_endtag(self,tag):
        if tag=='script' and self.current is not None:self.scripts.append(self.current);self.current=None
def checkjs(code,label):
    with tempfile.NamedTemporaryFile(suffix='.js',mode='w') as f:
        f.write(code);f.flush();r=subprocess.run(['node','--check',f.name],capture_output=True,text=True)
        if r.returncode:errors.append(f'{label}: {r.stderr}')
for p in root.rglob('*.html'):
    count+=1;parser=Parser();parser.feed(p.read_text())
    for link in parser.links:
        u=urlsplit(link)
        if u.scheme or u.netloc or not u.path:continue
        target=(root/u.path.lstrip('/')) if u.path.startswith('/') else p.parent/unquote(u.path)
        if target.is_dir():target=target/'index.html'
        if not target.exists():errors.append(f'{p.relative_to(root)}: missing {link}')
    for i,script in enumerate(parser.scripts):checkjs(script,f'{p.name} inline {i}')
for p in root.rglob('*.js'):checkjs(p.read_text(),p.relative_to(root))
if errors:
    print('\n'.join(errors));raise SystemExit(1)
print(f'PASS: {count} HTML pages; local links/assets and JavaScript syntax checked.')
