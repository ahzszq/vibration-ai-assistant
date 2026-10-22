"""Update shared UI modules without changing the embedded browser solver/PDF runtime."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def sync():
    modules = {name: (ROOT/name).read_text(encoding='utf-8').strip()
               for name in ('main.js', 'assistant.js', 'analysis.js', 'review.js', 'guide.js', 'modules.js')}
    def replace_script(match):
        source = match.group(1).strip()
        if source.startswith('/* Module navigation and image-assisted'):
            return '<script>\n'+modules['modules.js']+'\n</script>'
        if source.startswith('const names='):
            return '<script>\n'+modules['main.js']+'\n</script>'
        if source.startswith('/* Secrets stay'):
            return '<script>\n'+modules['assistant.js']+'\n'+modules['analysis.js']+'\n</script>'
        if source.startswith('/* Short, reproducible'):
            return '<script>\n'+modules['review.js']+'\n</script>'
        if source.startswith('(() => {\n const entry='):
            return '<script>\n'+modules['guide.js']+'\n</script>'
        return match.group(0)
    for path in (ROOT/'docs/index.html', ROOT/'振动AI实验助手.html'):
        html = path.read_text(encoding='utf-8')
        html = re.sub(r'<script\b[^>]*>([\s\S]*?)</script>', replace_script, html)
        html = re.sub(r'<style[^>]*>[\s\S]*?</style>', lambda _: '<style>\n'+
                      (ROOT/'styles.css').read_text(encoding='utf-8').strip()+'\n</style>', html, count=1)
        for name, source in modules.items():
            assert source in html, (path, name)
        path.write_text(html, encoding='utf-8')
    print('PASS: five UI modules synchronized in both standalone entry points.')


if __name__ == '__main__':
    sync()
