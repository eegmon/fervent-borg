import os, sys, re, json

folder = r'C:\Users\eegmon\Downloads\dosepro'
html_files = [f for f in os.listdir(folder) if f.endswith('.html')]

print(f'Found HTML files: {html_files}')

# Load existing hwpTemplates.js
js_path = r'C:\Users\eegmon\Documents\antigravity\fervent-borg\src\data\hwpTemplates.js'
with open(js_path, 'r', encoding='utf-8') as f:
    js_text = f.read()

# Extract JSON array from export const HWP_TEMPLATES = [...]
json_match = re.search(r'export const HWP_TEMPLATES = (\[.*\]);', js_text, re.DOTALL)
if json_match:
    templates = json.loads(json_match.group(1))
    
    for hf in html_files:
        path = os.path.join(folder, hf)
        with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
            html_raw = fp.read()
        
        # Check associated _style.css file
        css_file = hf.replace('.html', '_style.css')
        css_path = os.path.join(folder, css_file)
        css_content = ""
        if os.path.exists(css_path):
            with open(css_path, 'r', encoding='utf-8', errors='ignore') as cfp:
                css_content = cfp.read()

        # Combine HTML with inline <style> tag
        combined_html = f"<style>{css_content}</style>\n{html_raw}"
        
        # Find matching template
        title_base = hf.replace('.html', '').strip()
        matched = False
        for t in templates:
            if t['title'].strip() == title_base or '별지 제26호' in t['no']:
                t['htmlTable'] = combined_html
                t['hasExactHtml'] = True
                matched = True
                print(f"Injected exact HTML layout for template: {t['title']}")

    # Write back to hwpTemplates.js
    new_js_code = '/**\n * 대한민국 도스온라인 검찰청 공식 서식 (dosepro 100% 실물 HWP HTML 정밀 서식)\n */\n\n'
    new_js_code += 'export const HWP_TEMPLATES = ' + json.dumps(templates, ensure_ascii=False, indent=2) + ';\n'
    
    with open(js_path, 'w', encoding='utf-8') as fp:
        fp.write(new_js_code)
    print('Updated hwpTemplates.js with exact HTML templates!')
