from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json,subprocess,tempfile
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
plan_path=root/'data'/'learning-plan.json'
if plan_path.exists():
    try:
        plan=json.loads(plan_path.read_text())
        seen=set()
        for task in plan.get('tasks',[]):
            task_id=task.get('id')
            if not task_id or task_id in seen:errors.append(f'learning-plan.json: missing or duplicate task id {task_id!r}')
            seen.add(task_id)
            if task.get('defaultBucket') not in {'today','week','later','done'}:errors.append(f'learning-plan.json: invalid bucket for {task_id}')
            if task.get('contentState') not in {'ready','preparing'}:errors.append(f'learning-plan.json: invalid content state for {task_id}')
            url=task.get('url')
            if url:
                path=urlsplit(url).path
                target=root/path.lstrip('/')
                if target.is_dir():target=target/'index.html'
                if not target.exists():errors.append(f'learning-plan.json: missing {url} for {task_id}')
    except (ValueError,TypeError) as exc:errors.append(f'learning-plan.json: {exc}')
if errors:
    print('\n'.join(errors));raise SystemExit(1)
print(f'PASS: {count} HTML pages; local links/assets and JavaScript syntax checked.')
