"""Independent OOXML integrity oracle for the opt-in editor stress test (Python 3)."""
import hashlib
import json
import sys
import zipfile
import posixpath
from collections import Counter
from xml.etree import ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def tree(element):
    # The editor intentionally persists native anchor IDs on first open.
    attributes = [(key, value) for key, value in element.attrib.items()
                  if not key.startswith('{http://powertools.codeplex.com/2011}')]
    return [element.tag, sorted(attributes), element.text or '',
            [tree(child) for child in element]]


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False).encode()).hexdigest()


with zipfile.ZipFile(sys.argv[1]) as package:
    paragraphs, features, parts = {}, {}, {}
    for name in sorted(package.namelist()):
        data = package.read(name)
        if not name.endswith(('.xml', '.rels')):
            parts[name] = hashlib.sha256(data).hexdigest()
            continue
        root = ET.fromstring(data)
        if name.endswith('.rels'):
            # OPC permits equivalent relative and absolute internal targets.
            base = '/' + posixpath.dirname(posixpath.dirname(name))
            for relationship in root:
                if relationship.get('TargetMode') != 'External':
                    relationship.set('Target', posixpath.normpath(posixpath.join(base, relationship.get('Target', ''))))
            parts[name] = digest(sorted([tree(child) for child in root], key=str))
        elif name == '[Content_Types].xml':
            defaults = {child.get('Extension'): child.get('ContentType') for child in root if child.tag.endswith('}Default')}
            overrides = {child.get('PartName'): child.get('ContentType') for child in root if child.tag.endswith('}Override')}
            parts[name] = digest(sorted((part, overrides.get('/' + part, defaults.get(part.rsplit('.', 1)[-1])))
                                        for part in package.namelist() if part != name))
        else:
            parts[name] = digest(tree(root))
        if not name.startswith('word/'):
            continue
        ps = list(root.iter(W + 'p'))
        if not ps:
            continue
        features[name] = {
            'counts': dict(Counter(element.tag.removeprefix(W) for element in root.iter()
                                   if element.tag.startswith(W) and element.tag.removeprefix(W) in
                                   ['p', 'tbl', 'br', 'tab', 'noBreakHyphen', 'softHyphen', 'drawing',
                                    'footnoteReference', 'endnoteReference', 'fldChar', 'instrText',
                                    'bookmarkStart', 'bookmarkEnd', 'sectPr', 'numPr'])),
            'fields': [digest(tree(element)) for element in root.iter() if element.tag in
                       [W + 'instrText', W + 'fldChar', W + 'sectPr', W + 'bookmarkStart', W + 'bookmarkEnd']],
        }
        for index, paragraph in enumerate(ps):
            anchor = next((value for key, value in paragraph.attrib.items() if key.endswith('}Unid')), str(index))
            paragraphs[name + ':' + anchor] = {
                'text': ''.join(t.text or '' for t in paragraph.iter(W + 't')),
                'hash': digest(tree(paragraph)),
            }
    print(json.dumps({'parts': parts, 'features': features, 'paragraphs': paragraphs}))
