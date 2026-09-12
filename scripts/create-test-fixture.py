"""Build a tiny, reproducible OOXML fixture for native content-control integration tests."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

controls = [
    ('plain', '<w:text/>', '<w:r><w:t>Plain placeholder</w:t></w:r>'),
    ('rich', '', '<w:r><w:t>Rich placeholder</w:t></w:r>'),
    ('check', '<w14:checkbox><w14:checked w14:val="0"/><w14:checkedState w14:val="2612" w14:font="MS Gothic"/><w14:uncheckedState w14:val="2610" w14:font="MS Gothic"/></w14:checkbox>', '<w:r><w:t>☐</w:t></w:r>'),
    ('date', '<w:date><w:dateFormat w:val="yyyy-MM-dd"/><w:lid w:val="en-US"/><w:storeMappedDataAs w:val="dateTime"/><w:calendar w:val="gregorian"/></w:date>', '<w:r><w:t>Date</w:t></w:r>'),
    ('choice', '<w:dropDownList><w:listItem w:displayText="First" w:value="one"/><w:listItem w:displayText="Second" w:value="two"/></w:dropDownList>', '<w:r><w:t>First</w:t></w:r>'),
]
sdts = ''.join(f'<w:p><w:sdt><w:sdtPr><w:id w:val="{i+1}"/><w:tag w:val="{tag}"/>{properties}</w:sdtPr><w:sdtContent>{content}</w:sdtContent></w:sdt></w:p>' for i,(tag,properties,content) in enumerate(controls))
document = f'''<?xml version="1.0" encoding="utf-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w14"><w:body><w:p><w:r><w:t>Template document.</w:t></w:r></w:p>{sdts}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>'''
files = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': document,
}
target = Path('tests/fixtures/content-controls.docx')
target.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(target, 'w') as archive:
    for name, content in files.items():
        info = ZipInfo(name, (2026, 1, 1, 0, 0, 0)); info.compress_type = ZIP_DEFLATED
        archive.writestr(info, content.encode())
