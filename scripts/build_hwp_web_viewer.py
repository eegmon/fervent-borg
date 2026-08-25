import olefile, os, sys, re, json

folder = r'C:\Users\eegmon\Downloads\dosepro'
files = sorted(os.listdir(folder))

templates = []

for idx, f in enumerate(files, 1):
    path = os.path.join(folder, f)
    raw_text = ""
    
    try:
        if olefile.isOleFile(path):
            ole = olefile.OleFileIO(path)
            if ole.exists('PrvText'):
                raw_prv = ole.openstream('PrvText').read()
                raw_text = raw_prv.decode('utf-16le', errors='ignore').strip()
    except Exception as e:
        pass

    if not raw_text:
        with open(path, 'rb') as fp:
            raw = fp.read()
            raw_text = raw.decode('utf-16le', errors='ignore').strip()

    title = f.replace('.hwp', '')
    no_match = re.search(r'\[(별지 제\d+호서식)\]', title)
    no_str = no_match.group(1) if no_match else f'별지 제{idx}호서식'
    
    category = 'APPLICATION'
    if '영장' in title or '체포' in title: category = 'WARRANT'
    elif '공소' in title or '즉결' in title or '재판' in title or '항소' in title or '상고' in title: category = 'INDICTMENT'
    elif '통보' in title or '불기소' in title or '결정' in title or '송부' in title: category = 'NOTICE'

    raw_lines = raw_text.split('\n')
    clean_tags = []
    for l in raw_lines:
        s = l.replace('<', '').replace('>', '').strip()
        if s and '이 문서는' not in s and '도스온라인 검찰청' not in s and '■ 검찰사무규칙' not in s:
            clean_tags.append(s)

    grid_rows = ''
    for t_str in clean_tags:
        val_placeholder = '{notes}'
        if '사건번호' in t_str or '호' in t_str: val_placeholder = '{caseNo}'
        elif '성명' in t_str or '피의자' in t_str or '피고인' in t_str: val_placeholder = '{suspectName}'
        elif 'UUID' in t_str: val_placeholder = '{suspectUuid}'
        elif '죄명' in t_str or '제목' in t_str: val_placeholder = '{chargeName}'
        elif '검사' in t_str: val_placeholder = '{prosecutorName} 검사'
        elif '장소' in t_str or '주거' in t_str: val_placeholder = '{targetPlace}'
        elif '결정' in t_str or '결과' in t_str or '처분' in t_str: val_placeholder = '{disposition}'

        grid_rows += f'''
      <tr>
        <th style="width: 28%; background-color: #f8fafc; text-align: center; border: 1px solid #000; padding: 8px 12px; font-weight: bold; color: #000; font-size: 13px;">{t_str}</th>
        <td style="width: 72%; border: 1px solid #000; padding: 8px 12px; font-size: 14px; font-weight: 500; color: #000;">{val_placeholder}</td>
      </tr>'''

    html_document = f'''<div style="background-color: #ffffff; color: #000000; padding: 36px 44px; border: 2px solid #000000; font-family: 'Nanum Myeongjo', 'Noto Sans KR', serif; max-width: 800px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px double #000000; padding-bottom: 12px; margin-bottom: 20px;">
    <div style="font-size: 11px; font-weight: bold; color: #475569;">검찰사무규칙 [{no_str}]</div>
    <div style="font-size: 14px; font-weight: bold; letter-spacing: 2px; color: #0f172a;">도스온라인 검찰청</div>
    <div style="font-size: 11px; color: #64748b;">공문서 서식</div>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    <h2 style="font-size: 24px; font-weight: 900; letter-spacing: 4px; margin: 0; padding: 0; color: #000000;">{title}</h2>
  </div>

  <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000000; margin-bottom: 20px; font-size: 13px;">
    <tr>
      <th style="width: 15%; background-color: #f1f5f9; border: 1px solid #000; text-align: center;">수 신</th>
      <td style="width: 35%; border: 1px solid #000; padding-left: 8px;">도스온라인 법원</td>
      <th style="width: 15%; background-color: #f1f5f9; border: 1px solid #000; text-align: center;">발 신</th>
      <td style="width: 35%; border: 1px solid #000; padding-left: 8px;">도스온라인 검찰청</td>
    </tr>
  </table>

  <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 2px solid #000000; margin-bottom: 24px;">
    {grid_rows}
  </table>

  <div style="margin-top: 36px; text-align: center;">
    <div style="font-size: 14px; margin-bottom: 16px; font-weight: bold;">{{todayDate}}</div>
    <div style="font-size: 18px; font-weight: 900; letter-spacing: 2px; display: flex; align-items: center; justify-content: center; gap: 12px;">
      도스온라인 검찰청 검사 {{prosecutorName}} 
      <span style="display: inline-block; width: 44px; height: 44px; border: 2px solid #dc2626; color: #dc2626; border-radius: 50%; font-size: 12px; font-weight: 900; line-height: 44px; text-align: center;">(인)</span>
    </div>
  </div>

  <div style="margin-top: 32px; border-top: 1px solid #cbd5e1; padding-top: 12px; font-size: 11px; color: #64748b; text-align: center;">
    * 이 문서는 도스온라인(가상현실게임)에서 작성되었으며 실제 공문서가 아닙니다.
  </div>
</div>'''

    text_content = f'■ 검찰사무규칙 [{no_str}]\n<도스온라인 검찰청>\n\n' + raw_text + '\n\n--------------------------------------------------\n* 이 문서는 도스온라인(가상현실게임)에서 작성되었으며 실제 공문서가 아닙니다.'

    templates.append({
        'id': f'FORM_{idx:02d}',
        'no': no_str,
        'category': category,
        'title': title,
        'filename': f,
        'hwpFilePath': f'C:\\Users\\eegmon\\Downloads\\dosepro\\{f}',
        'desc': f'검찰사무규칙 {no_str} 대한민국 공문서 HWP 실물 서식',
        'content': text_content,
        'htmlTable': html_document
    })

js_code = '/**\n * 대한민국 도스온라인 검찰청 공식 서식 34종 (dosepro HWP 실물 서식 100% 웹 뷰어)\n */\n\n'
js_code += 'export const HWP_TEMPLATES = ' + json.dumps(templates, ensure_ascii=False, indent=2) + ';\n'

target_file = r'C:\Users\eegmon\Documents\antigravity\fervent-borg\src\data\hwpTemplates.js'
with open(target_file, 'w', encoding='utf-8') as fp:
    fp.write(js_code)

print(f'Successfully built {len(templates)} high-fidelity HWP Web Document Templates!')
