import os, sys, re, json

folder = r'C:\Users\eegmon\Downloads\dosepro'
files = sorted(os.listdir(folder))

templates = []

for idx, f in enumerate(files, 1):
    path = os.path.join(folder, f)
    with open(path, 'rb') as fp:
        raw = fp.read()
    
    decoded = raw.decode('utf-16le', errors='ignore')
    tags = re.findall(r'<[^>]{1,120}>', decoded)
    clean_tags = []
    seen = set()
    for t in tags:
        t_clean = t.strip()
        if any(0xac00 <= ord(c) <= 0xd7a3 for c in t_clean):
            if not any(ord(c) > 0xfa00 for c in t_clean) and '이 문서는' not in t_clean:
                if t_clean not in seen:
                    clean_tags.append(t_clean)
                    seen.add(t_clean)
    
    title = f.replace('.hwp', '')
    no_match = re.search(r'\[(별지 제\d+호서식)\]', title)
    no_str = no_match.group(1) if no_match else f'별지 제{idx}호서식'
    
    category = 'APPLICATION'
    if '영장' in title or '체포' in title: category = 'WARRANT'
    elif '공소' in title or '즉결' in title or '재판' in title or '항소' in title or '상고' in title: category = 'INDICTMENT'
    elif '통보' in title or '불기소' in title or '결정' in title or '송부' in title: category = 'NOTICE'

    # Plain text format
    lines = []
    lines.append(f'■ 검찰사무규칙 [{no_str}]')
    lines.append('<도스온라인 검찰청>')
    lines.append('')
    for tag in clean_tags:
        lines.append(tag)
    lines.append('')
    lines.append('{todayDate}')
    lines.append('도스온라인 검찰청 검사 {prosecutorName} (인)')
    lines.append('')
    lines.append('--------------------------------------------------')
    lines.append('* 이 문서는 도스온라인(가상현실게임)에서 작성되었으며 실제 공문서가 아닙니다.')

    # Rich HTML Table format matching HWP grid layout
    rows_html = ''
    for t in clean_tags:
        t_str = t.replace('<', '').replace('>', '').strip()
        if not t_str: continue
        val_placeholder = '{notes}'
        if '사건번호' in t_str: val_placeholder = '{caseNo}'
        elif '성명' in t_str or '피의자' in t_str or '피고인' in t_str: val_placeholder = '{suspectName}'
        elif 'UUID' in t_str: val_placeholder = '{suspectUuid}'
        elif '죄명' in t_str or '제목' in t_str: val_placeholder = '{chargeName}'
        elif '검사' in t_str: val_placeholder = '{prosecutorName} 검사'
        elif '장소' in t_str or '주거' in t_str: val_placeholder = '{targetPlace}'
        elif '결정' in t_str or '결과' in t_str or '처분' in t_str: val_placeholder = '{disposition}'

        rows_html += f'''
      <tr>
        <th style="width: 25%; background-color: #f1f5f9; text-align: center; border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; color: #334155;">{t_str}</th>
        <td style="width: 75%; border: 1px solid #cbd5e1; padding: 10px; line-height: 1.6;">{val_placeholder}</td>
      </tr>'''

    html_table = f'''<div style="font-family: 'Noto Sans KR', sans-serif; max-width: 780px; margin: 0 auto; color: #0f172a; padding: 10px;">
  <table border="1" cellpadding="10" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 2px solid #0f172a; font-size: 14px; margin-bottom: 14px;">
    <thead>
      <tr style="background-color: #0f172a; color: #ffffff; text-align: center;">
        <th colspan="2" style="padding: 16px; font-size: 19px; font-weight: bold; border: 1px solid #1e293b; letter-spacing: 1px;">
          검찰사무규칙 [{no_str}] {title}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th style="width: 25%; background-color: #f1f5f9; text-align: center; border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; color: #334155;">소속 기관</th>
        <td style="width: 75%; border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; color: #1e3a8a;">도스온라인 검찰청</td>
      </tr>
      {rows_html}
      <tr>
        <th style="background-color: #f1f5f9; text-align: center; border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; color: #334155;">작성 일자</th>
        <td style="border: 1px solid #cbd5e1; padding: 10px; font-weight: bold;">{{todayDate}}</td>
      </tr>
    </tbody>
  </table>

  <div style="text-align: right; font-weight: bold; font-size: 16px; margin-top: 14px; margin-bottom: 20px; color: #0f172a;">
    도스온라인 검찰청 검사 {{prosecutorName}} (인)
  </div>

  <div style="font-size: 11px; color: #64748b; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
    * 본 서식은 가상현실게임 도스온라인 검찰청의 공식 네이버 카페 표(Table) 양식입니다.
  </div>
</div>'''

    templates.append({
        'id': f'FORM_{idx:02d}',
        'no': no_str,
        'category': category,
        'title': title,
        'desc': f'검찰사무규칙 {no_str} HWP 표(Table) 양식',
        'content': '\n'.join(lines),
        'htmlTable': html_table,
        'rawTags': clean_tags
    })

js_code = '/**\n * 대한민국 도스온라인 검찰청 공식 서식 34종 (dosepro HWP 표 & 텍스트 서식)\n */\n\n'
js_code += 'export const HWP_TEMPLATES = ' + json.dumps(templates, ensure_ascii=False, indent=2) + ';\n'

target_file = r'C:\Users\eegmon\Documents\antigravity\fervent-borg\src\data\hwpTemplates.js'
with open(target_file, 'w', encoding='utf-8') as fp:
    fp.write(js_code)

print('Successfully generated hwpTemplates.js with 34 Rich HTML Tables!')
