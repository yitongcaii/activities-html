"""
PPT 字体修复脚本模板

Skill: ppt-visual-system v1.0.0

使用方法：
    python fix_fonts.py input.pptx output.pptx

功能：
    1. 将所有禁用字体替换为 TencentSans 系列
    2. 确保每个 <a:latin> 标签后有对应的 <a:ea> 标签（东亚字体声明）
    3. 验证修复结果
"""

import zipfile
import re
import os
import shutil
import sys

# ═══════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════

BOLD_FONT = 'TencentSans W7'
REG_FONT  = 'TencentSans W3'

# 字体黑名单：禁用字体 → 替换为
FONT_MAP = {
    'Calibri':          REG_FONT,
    'Arial':            REG_FONT,
    'Microsoft YaHei':  REG_FONT,
    'Consolas':         REG_FONT,
    'SimSun':           REG_FONT,
    'Times New Roman':  REG_FONT,
    '宋体':             REG_FONT,
    '华文细黑':         REG_FONT,
    '华文楷体':         REG_FONT,
    '华文宋体':         REG_FONT,
    '华文中宋':         REG_FONT,
    '华文仿宋':         REG_FONT,
}


def fix_xml(content):
    """修复 XML 内容中的字体引用"""
    # 1. 替换所有禁用字体
    for old, new in FONT_MAP.items():
        content = content.replace(
            'typeface="{}"'.format(old),
            'typeface="{}"'.format(new)
        )

    # 2. 确保 ea (East Asian) 字体声明存在
    for font in [BOLD_FONT, REG_FONT]:
        latin = '<a:latin typeface="{}"/>'.format(font)
        ea = '<a:ea typeface="{}"/>'.format(font)
        
        parts = content.split(latin)
        new_parts = [parts[0]]
        for part in parts[1:]:
            if not part.startswith('<a:ea'):
                if ea not in part[:200]:
                    new_parts.append(ea + part)
                else:
                    new_parts.append(part)
            else:
                new_parts.append(part)
        content = latin.join(new_parts)

    return content


def fix_pptx(input_path, output_path):
    """修复整个 PPTX 文件"""
    print('Input:  {}'.format(input_path))
    print('Output: {}'.format(output_path))
    
    with zipfile.ZipFile(input_path, 'r') as zin:
        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.namelist():
                data = zin.read(item)
                if item.endswith('.xml') or item.endswith('.rels'):
                    content = data.decode('utf-8')
                    content = fix_xml(content)
                    zout.writestr(item, content.encode('utf-8'))
                else:
                    zout.writestr(item, data)

    print('Done.')


def verify(path):
    """验证修复结果"""
    print('\n--- 验证 ---')
    old_fonts = set()
    
    with zipfile.ZipFile(path, 'r') as z:
        for name in z.namelist():
            if name.endswith('.xml'):
                c = z.read(name).decode('utf-8')
                for f in FONT_MAP.keys():
                    if f in c:
                        old_fonts.add((name, f))
        
        # 统计 slide 数量
        pres = z.read('ppt/presentation.xml').decode('utf-8')
        slides = re.findall(r'<p:sldId', pres)
        print('Slides: {}'.format(len(slides)))
    
    if old_fonts:
        print('⚠️  WARNING: 以下禁用字体仍然存在:')
        for fn, f in sorted(old_fonts):
            print('  {} in {}'.format(f, fn))
        return False
    else:
        print('✅ All fonts clean!')
        return True


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: python fix_fonts.py <input.pptx> <output.pptx>')
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    if not os.path.exists(input_path):
        print('Error: {} not found'.format(input_path))
        sys.exit(1)
    
    fix_pptx(input_path, output_path)
    verify(output_path)
