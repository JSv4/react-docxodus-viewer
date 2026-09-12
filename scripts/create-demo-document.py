"""Create the original, reproducible sample used by the demo's welcome screen."""
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
# Native sessions retain PowerTools anchors when saving. Declare that extension
# as ignorable so the sample remains valid Open XML after an editing round trip.
EXTENSIONS = ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:pt="http://powertools.codeplex.com/2011" mc:Ignorable="pt"'

def run(text, props=''):
    return f'<w:r><w:rPr>{props}</w:rPr><w:t xml:space="preserve">{escape(text)}</w:t></w:r>'

def paragraph(text='', style='Normal', content=None):
    return f'<w:p><w:pPr><w:pStyle w:val="{style}"/></w:pPr>{run(text) if content is None else content}</w:p>'

body = paragraph('STUDIO NOTES     /     NO. 001', 'Eyebrow')
body += paragraph('Good work takes shape.', 'Title')
body += paragraph('The launch brief  ·  September 2026', 'Subtitle')
body += paragraph('01   A shared direction', 'Heading1')
body += paragraph('Build a quieter place for important work. A document should carry the idea, the conversation, and a clear path to the next decision.')
body += paragraph(content=run('The goal is ')
    + '<w:del w:id="1" w:author="Maya" w:date="2026-09-12T09:00:00Z"><w:r><w:delText>another draft.</w:delText></w:r></w:del>'
    + '<w:ins w:id="2" w:author="Maya" w:date="2026-09-12T09:00:00Z">' + run('a shared direction.') + '</w:ins>')
body += paragraph('02   The details that matter', 'Heading1')
body += paragraph('Keep the review close to the writing. Comments belong with their paragraphs; revisions should tell a story; earlier versions should always be within reach.')
body += paragraph(content='<w:commentRangeStart w:id="0"/>' + run('Give every reviewer a clear next step before the final handoff.') + '<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>')
body += paragraph('03   From a draft to a decision', 'Heading1')
rows = [('MOMENT', 'WHAT HAPPENS NEXT'), ('First review', 'Discuss the language and resolve open questions.'), ('A new direction', 'Save a checkpoint before exploring another version.'), ('The handoff', 'Verify the document, then export the approved copy.')]
body += '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="DFE5D8"/><w:bottom w:val="single" w:sz="4" w:color="DFE5D8"/><w:insideH w:val="single" w:sz="4" w:color="E8EDE3"/></w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="2500"/><w:gridCol w:w="6500"/></w:tblGrid>'
for index, row in enumerate(rows):
    body += '<w:tr>'
    for col, text in enumerate(row):
        body += f'<w:tc><w:tcPr><w:tcW w:w="{2500 if col == 0 else 6500}" w:type="dxa"/>' + ('<w:shd w:val="clear" w:fill="F2F5ED"/>' if index == 0 else '') + '</w:tcPr>' + paragraph(text, 'TableHeading' if index == 0 else 'TableText') + '</w:tc>'
    body += '</w:tr>'
body += '</w:tbl>'
body += paragraph('Make room for the next good idea.', 'Closing')
body += '<w:sectPr><w:footerReference w:type="default" r:id="rFooter"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1260" w:bottom="1080" w:left="1260" w:header="500" w:footer="500"/></w:sectPr>'

styles = f'<w:styles xmlns:w="{W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="424B3A"/><w:sz w:val="21"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
style_defs = [
    ('Normal', 'Normal', '', ''),
    ('Title', 'Title', '<w:keepNext/><w:spacing w:before="180" w:after="160"/>', '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:color w:val="34432C"/><w:sz w:val="65"/>'),
    ('Eyebrow', 'Eyebrow', '<w:spacing w:after="60"/>', '<w:color w:val="889874"/><w:spacing w:val="22"/><w:sz w:val="15"/>'),
    ('Subtitle', 'Subtitle', '<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="15" w:color="DAE2D0"/></w:pBdr><w:spacing w:after="370"/>', '<w:color w:val="889579"/><w:sz w:val="19"/>'),
    ('Heading1', 'Heading 1', '<w:keepNext/><w:spacing w:before="230" w:after="130"/><w:outlineLvl w:val="0"/>', '<w:b/><w:color w:val="4A623B"/><w:sz w:val="22"/>'),
    ('TableHeading', 'Table heading', '<w:spacing w:after="0"/>', '<w:b/><w:color w:val="758965"/><w:sz w:val="15"/>'),
    ('TableText', 'Table text', '<w:spacing w:after="0"/>', '<w:sz w:val="18"/>'),
    ('Closing', 'Closing', '<w:spacing w:before="240"/>', '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:i/><w:color w:val="7C9268"/><w:sz w:val="23"/>'),
]
for sid, name, pp, rp in style_defs:
    styles += f'<w:style w:type="paragraph" w:styleId="{sid}"' + (' w:default="1"' if sid == 'Normal' else '') + f'><w:name w:val="{name}"/>' + ('<w:basedOn w:val="Normal"/>' if sid != 'Normal' else '') + f'<w:pPr>{pp}</w:pPr><w:rPr>{rp}</w:rPr></w:style>'
styles += '</w:styles>'
files = {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' + ''.join(f'<Override PartName="/word/{name}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.{kind}+xml"/>' for name, kind in [('document', 'document.main'), ('styles', 'styles'), ('comments', 'comments'), ('footer1', 'footer')]) + '</Types>',
    '_rels/.rels': f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rDocument" Type="{R}/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/_rels/document.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + ''.join(f'<Relationship Id="{rid}" Type="{R}/{kind}" Target="{target}.xml"/>' for rid, kind, target in [('rStyles', 'styles', 'styles'), ('rComments', 'comments', 'comments'), ('rFooter', 'footer', 'footer1')]) + '</Relationships>',
    'word/document.xml': f'<w:document xmlns:w="{W}" xmlns:r="{R}"><w:body>{body}</w:body></w:document>',
    'word/styles.xml': styles,
    'word/comments.xml': f'<w:comments xmlns:w="{W}"><w:comment w:id="0" w:author="Maya" w:initials="M" w:date="2026-09-12T09:00:00Z">{paragraph("Let’s make the next step clear. Could we include the offline HTML copy in the handoff?")}</w:comment></w:comments>',
    'word/footer1.xml': f'<w:ftr xmlns:w="{W}"><w:p><w:pPr><w:jc w:val="left"/></w:pPr>{run("DOCXODUS STUDIO   /   SAMPLE DOCUMENT", "<w:color w:val=\"93A083\"/><w:sz w:val=\"14\"/>")}</w:p></w:ftr>',
}
target = Path(__file__).resolve().parent.parent / 'public/sample.docx'
with ZipFile(target, 'w') as archive:
    for name, content in files.items():
        content = content.replace(f'xmlns:w="{W}"', f'xmlns:w="{W}"{EXTENSIONS}', 1)
        info = ZipInfo(name, (2026, 9, 12, 9, 0, 0))
        info.compress_type = ZIP_DEFLATED
        archive.writestr(info, ('<?xml version="1.0" encoding="UTF-8"?>' + content).encode())
print(target)
