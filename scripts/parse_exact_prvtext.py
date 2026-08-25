import olefile, os, sys, re, json

folder = r'C:\Users\eegmon\Downloads\dosepro'
files = sorted(os.listdir(folder))

templates = []

for idx, f in enumerate(files, 1):
    path = os.path.join(folder, f)
    ole = olefile.OleFileIO(path)
    
    if not ole.exists('PrvText'):
        continue

    raw_prv = ole.openstream('PrvText').read()
    raw_text = raw_prv.decode('utf-16le', errors='ignore').strip()
    
    title = f.replace('.hwp', '')
    no_match = re.search(r'\[(별지 제\d+호서식)\]', title)
    no_str = no_match.group(1) if no_match else f'별지 제{idx}호서식'
    
    category = 'APPLICATION'
    if '영장' in title or '체포' in title: category = 'WARRANT'
    elif '공소' in title or '즉결' in title or '재판' in title or '항소' in title or '상고' in title: category = 'INDICTMENT'
    elif '통보' in title or '불기소' in title or '결정' in title or '송부' in title: category = 'NOTICE'

    # Format PrvText lines into exact original template format
    raw_lines = raw_text.split('\n')
    clean_lines = []
    
    for l in raw_lines:
        line_str = l.strip()
        if not line_str: continue
        # Replace sample defaults with dynamic placeholders
        line_str = re.sub(r'2025년\s*형제\s*0000호', '{caseNo}', line_str)
        line_str = re.sub(r'2025형제0000호', '{caseNo}', line_str)
        line_str = re.sub(r'2025구속0000호', '{caseNo}', line_str)
        line_str = re.sub(r'2025수사0000호', '{caseNo}', line_str)
        line_str = re.sub(r'2025체포0000호', '{caseNo}', line_str)
        line_str = re.sub(r'검사이름', '{prosecutorName}', line_str)
        line_str = re.sub(r'OOO', '{suspectName}', line_str)
        line_str = line_str.replace('<', '').replace('>', '')
        clean_lines.append(line_str)

    content = '\n'.join(clean_lines)

    # Build Exact HTML Table Grid matching the PrvText structure
    table_rows = []
    for l in clean_lines:
        if '■ 검찰사무규칙' in l or '도스온라인 검찰청' in l:
            continue
        
        val = ''
        if '사건번호' in l: val = '{caseNo}'
        elif '성명' in l or '피의자' in l or '피고인' in l: val = '{suspectName}'
        elif 'UUID' in l: val = '{suspectUuid}'
        elif '죄명' in l or '제목' in l: val = '{chargeName}'
        elif '검사' in l: val = '{prosecutorName} 검사'
        elif '장소' in l or '주거' in l: val = '{targetPlace}'
        elif '결정' in l or '결과' in l or '처분' in l: val = '{disposition}'
        else: val = '{notes}'

        table_rows.append(f'''
      <tr>
        <th style="width: 28%; background-color: #f1f5f9; text-align: center; border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; color: #334155;">{l}</th>
        <td style="width: 72%; border: 1px solid #cbd5e1; padding: 10px; line-height: 1.6; font-weight: bold;">{val}</td>
      </tr>''')

    html_table = f'''<div style="font-family: 'Noto Sans KR', sans-serif; max-width: 780px; margin: 0 auto; color: #0f172a; padding: 10px;">
  <table border="1" cellpadding="10" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 2px solid #0f172a; font-size: 14px; margin-bottom: 14px;">
    <thead>
      <tr style="background-color: #0f172a; color: #ffffff; text-align: center;">
        <th colspan="2" style="padding: 16px; font-size: 18px; font-weight: bold; border: 1px solid #1e293b; letter-spacing: 1px;">
          검찰사무규칙 [{no_str}] {title}
        </th>
      </tr>
    </thead>
    <tbody>
      {''.join(table_rows)}
    </tbody>
  </table>

  <div style="text-align: right; font-weight: bold; font-size: 16px; margin-top: 14px; margin-bottom: 20px; color: #0f172a;">
    도스온라인 검찰청 검사 {{prosecutorName}} (인)
  </div>

  <div style="font-size: 11px; color: #64748b; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
    * 이 문서는 도스온라인(가상현실게임)에서 작성되었으며 실제 문서가 아닙니다.
  </div>
</div>'''

    templates.append({
        'id': f'FORM_{idx:02d}',
        'no': no_str,
        'category': category,
        'title': title,
        'desc': f'dosepro 원본 PrvText HWP 서식',
        'content': content,
        'htmlTable': html_table
    })

js_code = '/**\n * 대한민국 도스온라인 검찰청 공식 서식 34종 (dosepro HWP PrvText 100% 원본)\n */\n\n'
js_code += 'export const HWP_TEMPLATES = ' + json.dumps(templates, ensure_ascii=False, indent=2) + ';\n'

target_file = r'C:\Users\eegmon\Documents\antigravity\fervent-borg\src\data\hwpTemplates.js'
with open(target_file, 'w', encoding='utf-8') as fp:
    fp.write(js_code)

print(f'Successfully parsed {len(templates)} exact PrvText HWP templates!')
