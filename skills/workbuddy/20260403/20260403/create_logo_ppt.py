"""
AISee Security Logo PPT Generator
渐变流光风格 + 盾牌安全元素
"""
import math
import io
import base64
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import numpy as np

# ============================================================
# Utility functions
# ============================================================

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_gradient(size, colors, angle=0):
    """Create a linear gradient image with given colors and angle."""
    w, h = size
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    pixels = np.zeros((h, w, 4), dtype=np.uint8)

    rad = math.radians(angle)
    dx = math.cos(rad)
    dy = math.sin(rad)

    # Normalize so gradient spans the diagonal
    max_dist = abs(w * dx) + abs(h * dy)
    if max_dist == 0:
        max_dist = 1

    for y in range(h):
        for x in range(w):
            t = (x * dx + y * dy) / max_dist
            t = max(0, min(1, t))
            pos = t * (len(colors) - 1)
            idx = int(pos)
            frac = pos - idx
            if idx >= len(colors) - 1:
                c = colors[-1]
            else:
                c1 = colors[idx]
                c2 = colors[idx + 1]
                c = tuple(int(c1[i] + (c2[i] - c1[i]) * frac) for i in range(4))
            pixels[y, x] = c

    return Image.fromarray(pixels)

def draw_glow_circle(draw, center, radius, color, intensity=3):
    """Draw a glowing circle effect."""
    for i in range(intensity, 0, -1):
        alpha = int(60 / i)
        r = radius + i * 8
        glow_color = color[:3] + (alpha,)
        draw.ellipse([center[0]-r, center[1]-r, center[0]+r, center[1]+r], fill=glow_color)

def draw_shield(draw, cx, cy, size, color, outline_color=None, outline_width=3):
    """Draw a futuristic shield shape."""
    # Shield points (top to bottom)
    top = cy - size
    bottom = cy + int(size * 1.3)
    mid_width = int(size * 0.85)
    top_width = int(size * 0.65)

    points = [
        (cx, top),                        # top center
        (cx + top_width, cy - int(size*0.3)),  # top right
        (cx + mid_width, cy + int(size*0.2)),  # mid right
        (cx + int(mid_width*0.7), cy + int(size*0.7)),  # lower right
        (cx, bottom),                     # bottom point
        (cx - int(mid_width*0.7), cy + int(size*0.7)),  # lower left
        (cx - mid_width, cy + int(size*0.2)),  # mid left
        (cx - top_width, cy - int(size*0.3)),  # top left
    ]

    # Draw filled shield with slight transparency
    fill_color = color[:3] + (180,) if len(color) == 3 else color
    draw.polygon(points, fill=fill_color, outline=outline_color, width=outline_width)
    return points

def draw_glow_line(draw, start, end, color, width=2, glow_layers=5):
    """Draw a glowing line."""
    for i in range(glow_layers, 0, -1):
        alpha = int(40 / i)
        w = width + i * 3
        glow_color = color[:3] + (alpha,)
        draw.line([start, end], fill=glow_color, width=w)
    draw.line([start, end], fill=color, width=width)

def draw_circuit_lines(draw, cx, cy, size, color):
    """Draw circuit-like patterns on shield."""
    line_color = color[:3] + (100,)
    import random
    random.seed(42)
    for _ in range(8):
        angle = random.uniform(0, 2 * math.pi)
        r1 = size * random.uniform(0.2, 0.5)
        r2 = size * random.uniform(0.4, 0.8)
        x1 = cx + int(r1 * math.cos(angle))
        y1 = cy + int(r1 * math.sin(angle))
        x2 = cx + int(r2 * math.cos(angle + random.uniform(-0.3, 0.3)))
        y2 = cy + int(r2 * math.sin(angle + random.uniform(-0.3, 0.3)))
        draw.line([(x1, y1), (x2, y2)], fill=line_color, width=1)
        # Node dot
        draw.ellipse([x2-2, y2-2, x2+2, y2+2], fill=color)

def draw_light_particles(img, cx, cy, radius, count=30, color=(100, 200, 255)):
    """Draw floating light particles around the shield."""
    draw = ImageDraw.Draw(img)
    import random
    random.seed(123)
    for _ in range(count):
        angle = random.uniform(0, 2 * math.pi)
        dist = random.uniform(radius * 0.8, radius * 1.5)
        x = cx + int(dist * math.cos(angle))
        y = cy + int(dist * math.sin(angle))
        size = random.uniform(1, 3)
        alpha = random.randint(80, 200)
        c = color + (alpha,)
        draw.ellipse([x-size, y-size, x+size, y+size], fill=c)

def draw_light_streaks(img, cx, cy, radius, count=12):
    """Draw light streaks radiating outward."""
    draw = ImageDraw.Draw(img)
    import random
    random.seed(77)
    for _ in range(count):
        angle = random.uniform(0, 2 * math.pi)
        length = random.uniform(radius * 0.5, radius * 1.2)
        start_r = radius * 0.7
        x1 = cx + int(start_r * math.cos(angle))
        y1 = cy + int(start_r * math.sin(angle))
        x2 = cx + int((start_r + length) * math.cos(angle))
        y2 = cy + int((start_r + length) * math.sin(angle))

        # Gradient streak
        for i in range(20):
            t = i / 20.0
            px = int(x1 + (x2 - x1) * t)
            py = int(y1 + (y2 - y1) * t)
            alpha = int(150 * (1 - t))
            c = (100 + int(50*t), 180 + int(75*t), 255, alpha)
            draw.ellipse([px-1, py-1, px+1, py+1], fill=c)

def draw_ai_eye(draw, cx, cy, size, color):
    """Draw an AI eye symbol inside the shield."""
    # Eye shape (almond)
    eye_w = int(size * 0.6)
    eye_h = int(size * 0.25)

    # Eye outline
    for offset in range(3, 0, -1):
        alpha = 80 + (3-offset) * 50
        ec = color[:3] + (alpha,)
        # Top curve
        draw.arc([cx-eye_w-offset, cy-eye_h-offset, cx+eye_w+offset, cy+eye_h+offset],
                 200, 340, fill=ec, width=2)
        # Bottom curve
        draw.arc([cx-eye_w-offset, cy-eye_h-offset, cx+eye_w+offset, cy+eye_h+offset],
                 20, 160, fill=ec, width=2)

    # Pupil (glowing circle)
    draw.ellipse([cx-8, cy-8, cx+8, cy+8], fill=color)
    draw.ellipse([cx-4, cy-4, cx+4, cy+4], fill=(255, 255, 255, 230))


# ============================================================
# Logo Design Functions
# ============================================================

def create_logo_version_a(size=(800, 800)):
    """Version A: 深色背景 + 流光盾牌 + AISee文字"""
    w, h = size
    img = Image.new('RGBA', size, (12, 15, 30, 255))

    # Background gradient overlay
    bg_grad = create_gradient(size, [
        (12, 15, 30, 255),
        (20, 30, 60, 255),
        (15, 20, 45, 255),
    ], angle=135)
    img = Image.alpha_composite(img, bg_grad)

    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2 - 30
    shield_size = 140

    # Outer glow
    for i in range(8, 0, -1):
        r = shield_size + i * 20
        alpha = int(15 / i * 3)
        c = (50, 120, 255, alpha)
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=c)

    # Draw shield with gradient fill
    shield_layer = Image.new('RGBA', size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shield_layer)

    # Multi-layer shield for gradient effect
    shield_colors = [
        ((30, 80, 180, 120), (cx, cy-2, shield_size+2)),
        ((50, 120, 220, 100), (cx, cy, shield_size)),
        ((80, 160, 255, 80), (cx, cy+2, shield_size-4)),
    ]

    for fill_c, (scx, scy, ss) in shield_colors:
        draw_shield(sd, scx, scy, ss, fill_c, (100, 180, 255, 200), 2)

    # Circuit lines on shield
    draw_circuit_lines(sd, cx, cy, shield_size, (120, 200, 255, 150))

    # AI eye inside shield
    draw_ai_eye(sd, cx, cy - 15, shield_size, (100, 220, 255, 220))

    img = Image.alpha_composite(img, shield_layer)

    # Light particles
    draw_light_particles(img, cx, cy, shield_size, 40, (80, 180, 255))

    # Light streaks
    draw_light_streaks(img, cx, cy, shield_size, 15)

    # Horizontal glow line below shield
    glow_line_layer = Image.new('RGBA', size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_line_layer)
    line_y = cy + int(shield_size * 1.5)
    for i in range(6, 0, -1):
        alpha = int(50 / i * 2)
        c = (60, 140, 255, alpha)
        gd.line([(cx-200, line_y), (cx+200, line_y)], fill=c, width=i*3)
    gd.line([(cx-200, line_y), (cx+200, line_y)], fill=(120, 200, 255, 200), width=2)
    img = Image.alpha_composite(img, glow_line_layer)

    # Text: AISee
    try:
        font_large = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 72)
        font_small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 28)
    except:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()

    text_y = line_y + 25

    # "AI" in cyan gradient
    text_layer = Image.new('RGBA', size, (0, 0, 0, 0))
    td = ImageDraw.Draw(text_layer)

    # Glow behind text
    for i in range(5, 0, -1):
        alpha = int(30 / i * 2)
        c = (50, 150, 255, alpha)
        td.text((cx - 145, text_y - 5), "AISee", font=font_large, fill=c)

    # Main text with gradient effect (simulate with two draws)
    td.text((cx - 145, text_y), "AI", font=font_large, fill=(100, 200, 255, 255))
    td.text((cx - 20, text_y), "See", font=font_large, fill=(180, 140, 255, 255))

    # Tagline
    td.text((cx - 100, text_y + 80), "AI-Powered Security", font=font_small, fill=(150, 180, 220, 180))

    img = Image.alpha_composite(img, text_layer)

    return img.convert('RGB')


def create_logo_version_b(size=(800, 800)):
    """Version B: 白色背景 + 流光盾牌 + 极简风格"""
    w, h = size
    img = Image.new('RGBA', size, (255, 255, 255, 255))

    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2 - 40
    shield_size = 130

    # Soft shadow
    shadow_layer = Image.new('RGBA', size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    draw_shield(sd, cx+4, cy+4, shield_size, (0, 0, 0, 30))
    img = Image.alpha_composite(img, shadow_layer)

    # Main shield - gradient blue to purple
    shield_layer = Image.new('RGBA', size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shield_layer)

    # Create gradient on shield using horizontal strips
    for y_off in range(-shield_size, int(shield_size*1.3)+1):
        t = (y_off + shield_size) / (shield_size * 2.3)
        r = int(40 + t * 80)
        g = int(100 + t * 20)
        b = int(220 + t * 35)
        a = 200
        draw.line([(cx, cy+y_off), (cx, cy+y_off)], fill=(0,0,0,0))

    # Shield layers
    draw_shield(sd, cx, cy, shield_size+2, (30, 60, 160, 200), (60, 130, 230, 230), 3)
    draw_shield(sd, cx, cy, shield_size-6, (60, 100, 200, 120), None, 0)

    # Gradient overlay on shield (vertical gradient)
    grad_overlay = create_gradient(size, [
        (0, 0, 0, 0),
        (80, 40, 180, 60),
        (0, 0, 0, 0),
    ], angle=180)

    # Clip gradient to shield area
    mask = Image.new('L', size, 0)
    md = ImageDraw.Draw(mask)
    points = [
        (cx, cy-shield_size),
        (cx+int(shield_size*0.65), cy-int(shield_size*0.3)),
        (cx+int(shield_size*0.85), cy+int(shield_size*0.2)),
        (cx+int(shield_size*0.6), cy+int(shield_size*0.7)),
        (cx, cy+int(shield_size*1.3)),
        (cx-int(shield_size*0.6), cy+int(shield_size*0.7)),
        (cx-int(shield_size*0.85), cy+int(shield_size*0.2)),
        (cx-int(shield_size*0.65), cy-int(shield_size*0.3)),
    ]
    md.polygon(points, fill=255)

    shield_layer = Image.alpha_composite(shield_layer, Image.composite(grad_overlay, shield_layer, mask))

    # Circuit pattern
    draw_circuit_lines(sd, cx, cy, shield_size, (100, 160, 255, 120))

    # Eye symbol
    draw_ai_eye(sd, cx, cy - 10, shield_size, (80, 160, 255, 230))

    img = Image.alpha_composite(img, shield_layer)

    # Light streaks (subtle)
    draw_light_particles(img, cx, cy, shield_size, 25, (80, 150, 255))
    draw_light_streaks(img, cx, cy, shield_size, 10)

    # Glow line
    glow_layer = Image.new('RGBA', size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer)
    line_y = cy + int(shield_size * 1.5)
    for i in range(5, 0, -1):
        alpha = int(30 / i * 2)
        c = (60, 120, 220, alpha)
        gd.line([(cx-180, line_y), (cx+180, line_y)], fill=c, width=i*2)
    gd.line([(cx-180, line_y), (cx+180, line_y)], fill=(80, 150, 240, 150), width=2)
    img = Image.alpha_composite(img, glow_layer)

    # Text
    try:
        font_large = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 68)
        font_small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 26)
    except:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()

    text_layer = Image.new('RGBA', size, (0, 0, 0, 0))
    td = ImageDraw.Draw(text_layer)
    text_y = line_y + 20

    td.text((cx - 135, text_y), "AI", font=font_large, fill=(40, 100, 200, 255))
    td.text((cx - 10, text_y), "See", font=font_large, fill=(120, 80, 200, 255))
    td.text((cx - 95, text_y + 75), "Intelligent Security", font=font_small, fill=(100, 120, 160, 180))

    img = Image.alpha_composite(img, text_layer)

    return img.convert('RGB')


def create_logo_version_c(size=(800, 800)):
    """Version C: 暗色渐变背景 + 盾牌内嵌眼睛 + 极光流光效果"""
    w, h = size
    img = Image.new('RGBA', size, (8, 10, 25, 255))

    # Background: deep blue-purple gradient
    bg = create_gradient(size, [
        (8, 10, 25, 255),
        (15, 25, 55, 255),
        (25, 15, 50, 255),
        (10, 12, 30, 255),
    ], angle=160)
    img = Image.alpha_composite(img, bg)

    # Aurora effect (subtle)
    aurora_layer = Image.new('RGBA', size, (0, 0, 0, 0))
    ad = ImageDraw.Draw(aurora_layer)
    import random
    random.seed(999)
    for _ in range(50):
        x = random.randint(0, w)
        y = random.randint(0, h // 2)
        size_p = random.uniform(20, 80)
        alpha = random.randint(3, 12)
        color_choice = random.choice([
            (40, 80, 200, alpha),
            (80, 40, 180, alpha),
            (60, 120, 200, alpha),
        ])
        ad.ellipse([x-size_p, y-size_p, x+size_p, y+size_p], fill=color_choice)
    img = Image.alpha_composite(img, aurora_layer)

    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2 - 20
    shield_size = 145

    # Outer glow ring
    for i in range(12, 0, -1):
        r = shield_size + i * 15
        alpha = int(8 + (12 - i) * 2)
        c = (60 + (12-i)*5, 100 + (12-i)*8, 220, alpha)
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=c)

    # Shield
    shield_layer = Image.new('RGBA', size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shield_layer)

    # Shield with glass-like effect
    draw_shield(sd, cx, cy, shield_size, (20, 50, 120, 150), (100, 180, 255, 180), 2)
    draw_shield(sd, cx, cy, shield_size - 8, (40, 80, 160, 80), None, 0)

    # Inner glow at top of shield
    for i in range(5, 0, -1):
        alpha = int(20 / i)
        inner_y = cy - shield_size + int(shield_size * 0.4)
        c = (120, 200, 255, alpha)
        sd.ellipse([cx-int(shield_size*0.3)-i*5, inner_y-i*5,
                     cx+int(shield_size*0.3)+i*5, inner_y+int(shield_size*0.4)+i*5], fill=c)

    # Circuit lines
    draw_circuit_lines(sd, cx, cy, shield_size, (100, 200, 255, 130))

    # AI Eye (prominent)
    draw_ai_eye(sd, cx, cy - 10, shield_size, (120, 220, 255, 240))

    img = Image.alpha_composite(img, shield_layer)

    # Particles and streaks
    draw_light_particles(img, cx, cy, shield_size, 50, (80, 180, 255))
    draw_light_streaks(img, cx, cy, shield_size, 18)

    # Bottom glow line (gradient from cyan to purple)
    glow_layer = Image.new('RGBA', size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer)
    line_y = cy + int(shield_size * 1.5)
    steps = 100
    for i in range(steps):
        x = cx - 200 + int(400 * i / steps)
        t = i / steps
        r = int(60 + t * 80)
        g = int(140 - t * 40)
        b = int(255 - t * 30)
        for j in range(4, 0, -1):
            alpha = int(40 / j)
            gd.line([(x, line_y-j*2), (x, line_y+j*2)], fill=(r, g, b, alpha), width=1)
    gd.line([(cx-200, line_y), (cx+200, line_y)], fill=(150, 180, 255, 220), width=2)
    img = Image.alpha_composite(img, glow_layer)

    # Text
    try:
        font_large = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 72)
        font_small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 28)
    except:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()

    text_layer = Image.new('RGBA', size, (0, 0, 0, 0))
    td = ImageDraw.Draw(text_layer)
    text_y = line_y + 25

    # Glow behind text
    for i in range(6, 0, -1):
        alpha = int(20 / i * 2)
        td.text((cx - 145, text_y - 3), "AISee", font=font_large, fill=(80, 150, 255, alpha))

    # Gradient text
    td.text((cx - 145, text_y), "AI", font=font_large, fill=(80, 200, 255, 255))
    td.text((cx - 20, text_y), "See", font=font_large, fill=(160, 120, 255, 255))

    # Underline decoration
    td.text((cx - 110, text_y + 80), "AI  ·  Security  ·  Intelligence", font=font_small, fill=(140, 170, 210, 160))

    img = Image.alpha_composite(img, text_layer)

    return img.convert('RGB')


def create_logo_icon_only(size=(600, 600)):
    """Icon only version: just the shield+eye symbol, no text"""
    w, h = size
    img = Image.new('RGBA', size, (10, 14, 30, 255))

    bg = create_gradient(size, [
        (10, 14, 30, 255),
        (18, 28, 55, 255),
        (12, 18, 40, 255),
    ], angle=135)
    img = Image.alpha_composite(img, bg)

    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2
    shield_size = 150

    # Outer glow
    for i in range(10, 0, -1):
        r = shield_size + i * 18
        alpha = int(10 + (10 - i) * 3)
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(50, 110, 230, alpha))

    # Shield
    shield_layer = Image.new('RGBA', size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shield_layer)

    draw_shield(sd, cx, cy, shield_size, (25, 60, 140, 160), (90, 170, 255, 200), 3)
    draw_shield(sd, cx, cy, shield_size - 10, (45, 90, 180, 80), None, 0)
    draw_circuit_lines(sd, cx, cy, shield_size, (110, 190, 255, 140))
    draw_ai_eye(sd, cx, cy - 5, shield_size, (110, 220, 255, 235))

    img = Image.alpha_composite(img, shield_layer)
    draw_light_particles(img, cx, cy, shield_size, 45, (70, 170, 255))
    draw_light_streaks(img, cx, cy, shield_size, 16)

    return img.convert('RGB')


def create_color_palette(size=(800, 200)):
    """Create a color palette strip for the brand"""
    w, h = size
    img = Image.new('RGB', size, (20, 25, 50))
    draw = ImageDraw.Draw(img)

    colors = [
        ("#0A0E1E", "Deep Night"),
        ("#1E3A6E", "Royal Blue"),
        ("#3C78DC", "Core Blue"),
        ("#64C8FF", "Cyan Glow"),
        ("#A078FF", "Aurora Purple"),
        ("#F0F4FF", "Light Mist"),
    ]

    try:
        font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 16)
        font_bold = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 18)
    except:
        font = ImageFont.load_default()
        font_bold = font

    swatch_w = w // len(colors)
    for i, (hex_c, name) in enumerate(colors):
        x = i * swatch_w
        rgb = hex_to_rgb(hex_c)
        draw.rectangle([x, 20, x + swatch_w - 8, 120], fill=rgb, outline=(80, 100, 140))
        draw.text((x + 10, 130), hex_c, font=font_bold, fill=(200, 210, 230))
        draw.text((x + 10, 155), name, font=font, fill=(150, 160, 180))

    return img


def img_to_base64(img, format='PNG'):
    """Convert PIL image to base64 string."""
    buf = io.BytesIO()
    img.save(buf, format=format)
    return base64.b64encode(buf.getvalue()).decode('utf-8')


# ============================================================
# PPT HTML Generation
# ============================================================

def generate_ppt():
    """Generate the full logo presentation PPT as HTML."""
    # Generate all logo images
    print("Generating logo Version A...")
    logo_a = create_logo_version_a()
    logo_a_b64 = img_to_base64(logo_a)

    print("Generating logo Version B...")
    logo_b = create_logo_version_b()
    logo_b_b64 = img_to_base64(logo_b)

    print("Generating logo Version C...")
    logo_c = create_logo_version_c()
    logo_c_b64 = img_to_base64(logo_c)

    print("Generating icon version...")
    logo_icon = create_logo_icon_only()
    logo_icon_b64 = img_to_base64(logo_icon)

    print("Generating color palette...")
    palette = create_color_palette()
    palette_b64 = img_to_base64(palette)

    # Generate smaller versions for comparison slides
    print("Generating comparison versions...")
    logo_a_small = logo_a.resize((360, 360), Image.LANCZOS)
    logo_b_small = logo_b.resize((360, 360), Image.LANCZOS)
    logo_c_small = logo_c.resize((360, 360), Image.LANCZOS)

    logo_a_small_b64 = img_to_base64(logo_a_small)
    logo_b_small_b64 = img_to_base64(logo_b_small)
    logo_c_small_b64 = img_to_base64(logo_c_small)

    # Generate favicon-sized logo
    logo_favicon = logo_icon.resize((120, 120), Image.LANCZOS)
    logo_favicon_b64 = img_to_base64(logo_favicon)

    print("Building HTML...")

    html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AISee Security Logo Design</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+SC:wght@300;400;500;700&display=swap');

* {{
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}}

body {{
    font-family: 'Inter', 'Noto Sans SC', sans-serif;
    background: #0a0e1e;
    color: #e0e8f5;
    overflow-x: hidden;
}}

/* Slide System */
.slide {{
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    scroll-snap-align: start;
}}

.slide-content {{
    z-index: 2;
    text-align: center;
    max-width: 90vw;
}}

/* Navigation */
.nav {{
    position: fixed;
    right: 24px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 12px;
}}

.nav-dot {{
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(100, 200, 255, 0.3);
    border: 1px solid rgba(100, 200, 255, 0.5);
    cursor: pointer;
    transition: all 0.3s ease;
}}

.nav-dot:hover, .nav-dot.active {{
    background: rgba(100, 200, 255, 0.9);
    box-shadow: 0 0 12px rgba(100, 200, 255, 0.6);
    transform: scale(1.3);
}}

/* Page counter */
.page-counter {{
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    font-size: 14px;
    color: rgba(150, 170, 200, 0.6);
    letter-spacing: 2px;
}}

/* ===== SLIDE 0: COVER ===== */
.slide-0 {{
    background: radial-gradient(ellipse at 50% 40%, rgba(40, 80, 180, 0.3) 0%, transparent 60%),
                radial-gradient(ellipse at 30% 70%, rgba(120, 60, 200, 0.15) 0%, transparent 50%),
                #080c1a;
}}

.slide-0 .cover-logo {{
    width: 280px;
    height: 280px;
    border-radius: 32px;
    box-shadow: 0 0 60px rgba(60, 120, 220, 0.3), 0 0 120px rgba(60, 120, 220, 0.1);
    margin: 0 auto 40px;
    animation: float 6s ease-in-out infinite;
}}

@keyframes float {{
    0%, 100% {{ transform: translateY(0px); }}
    50% {{ transform: translateY(-15px); }}
}}

.slide-0 h1 {{
    font-size: 56px;
    font-weight: 800;
    background: linear-gradient(135deg, #64c8ff 0%, #a078ff 50%, #64c8ff 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 4s linear infinite;
    margin-bottom: 16px;
    letter-spacing: -1px;
}}

@keyframes shimmer {{
    0% {{ background-position: 0% center; }}
    100% {{ background-position: 200% center; }}
}}

.slide-0 .subtitle {{
    font-size: 20px;
    color: rgba(150, 180, 220, 0.7);
    font-weight: 300;
    letter-spacing: 6px;
    text-transform: uppercase;
    margin-bottom: 40px;
}}

.slide-0 .tagline {{
    font-size: 16px;
    color: rgba(120, 150, 190, 0.5);
    letter-spacing: 3px;
}}

/* ===== SLIDE 1: VERSION A ===== */
.slide-1 {{
    background: radial-gradient(ellipse at 50% 30%, rgba(30, 60, 150, 0.25) 0%, transparent 60%), #080c1a;
    padding: 60px;
}}

.slide-1 .logo-display {{
    width: 480px;
    height: 480px;
    border-radius: 24px;
    box-shadow: 0 0 40px rgba(60, 120, 220, 0.2);
    margin-bottom: 30px;
}}

.slide-1 h2 {{
    font-size: 32px;
    font-weight: 700;
    color: #64c8ff;
    margin-bottom: 8px;
}}

.slide-1 .version-label {{
    font-size: 14px;
    color: rgba(150, 170, 200, 0.5);
    letter-spacing: 4px;
    text-transform: uppercase;
    margin-bottom: 20px;
}}

.slide-1 .desc {{
    font-size: 16px;
    color: rgba(180, 195, 220, 0.7);
    max-width: 500px;
    line-height: 1.8;
}}

/* ===== SLIDE 2: VERSION B ===== */
.slide-2 {{
    background: radial-gradient(ellipse at 50% 30%, rgba(60, 40, 140, 0.2) 0%, transparent 60%), #0a0c18;
    padding: 60px;
}}

.slide-2 .logo-display {{
    width: 480px;
    height: 480px;
    border-radius: 24px;
    box-shadow: 0 0 40px rgba(100, 80, 200, 0.15);
    margin-bottom: 30px;
}}

.slide-2 h2 {{
    font-size: 32px;
    font-weight: 700;
    color: #a078ff;
    margin-bottom: 8px;
}}

.slide-2 .version-label {{
    font-size: 14px;
    color: rgba(150, 170, 200, 0.5);
    letter-spacing: 4px;
    text-transform: uppercase;
    margin-bottom: 20px;
}}

.slide-2 .desc {{
    font-size: 16px;
    color: rgba(180, 195, 220, 0.7);
    max-width: 500px;
    line-height: 1.8;
}}

/* ===== SLIDE 3: VERSION C ===== */
.slide-3 {{
    background: radial-gradient(ellipse at 50% 30%, rgba(40, 80, 180, 0.2) 0%, transparent 60%),
                radial-gradient(ellipse at 70% 70%, rgba(100, 50, 180, 0.15) 0%, transparent 50%),
                #080c1a;
    padding: 60px;
}}

.slide-3 .logo-display {{
    width: 480px;
    height: 480px;
    border-radius: 24px;
    box-shadow: 0 0 40px rgba(80, 120, 220, 0.2), 0 0 80px rgba(120, 80, 220, 0.1);
    margin-bottom: 30px;
}}

.slide-3 h2 {{
    font-size: 32px;
    font-weight: 700;
    background: linear-gradient(135deg, #64c8ff, #a078ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 8px;
}}

.slide-3 .version-label {{
    font-size: 14px;
    color: rgba(150, 170, 200, 0.5);
    letter-spacing: 4px;
    text-transform: uppercase;
    margin-bottom: 20px;
}}

.slide-3 .desc {{
    font-size: 16px;
    color: rgba(180, 195, 220, 0.7);
    max-width: 500px;
    line-height: 1.8;
}}

/* ===== SLIDE 4: COMPARISON ===== */
.slide-4 {{
    background: #0a0e1e;
    padding: 60px;
}}

.slide-4 h2 {{
    font-size: 36px;
    font-weight: 700;
    margin-bottom: 12px;
    background: linear-gradient(135deg, #64c8ff, #a078ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}}

.slide-4 .sub {{
    font-size: 16px;
    color: rgba(150, 170, 200, 0.5);
    margin-bottom: 50px;
    letter-spacing: 2px;
}}

.comparison-grid {{
    display: flex;
    gap: 40px;
    justify-content: center;
    align-items: flex-start;
    flex-wrap: wrap;
}}

.comparison-card {{
    background: rgba(20, 30, 60, 0.6);
    border: 1px solid rgba(60, 120, 220, 0.15);
    border-radius: 20px;
    padding: 24px;
    text-align: center;
    transition: all 0.4s ease;
    cursor: pointer;
}}

.comparison-card:hover {{
    border-color: rgba(100, 200, 255, 0.4);
    box-shadow: 0 8px 40px rgba(60, 120, 220, 0.2);
    transform: translateY(-8px);
}}

.comparison-card img {{
    width: 280px;
    height: 280px;
    border-radius: 16px;
    margin-bottom: 16px;
}}

.comparison-card h3 {{
    font-size: 18px;
    font-weight: 600;
    color: #c0d0e8;
    margin-bottom: 6px;
}}

.comparison-card p {{
    font-size: 13px;
    color: rgba(150, 170, 200, 0.5);
}}

/* ===== SLIDE 5: DESIGN ELEMENTS ===== */
.slide-5 {{
    background: #0a0e1e;
    padding: 60px;
}}

.slide-5 h2 {{
    font-size: 36px;
    font-weight: 700;
    margin-bottom: 12px;
    color: #e0e8f5;
}}

.slide-5 .sub {{
    font-size: 16px;
    color: rgba(150, 170, 200, 0.5);
    margin-bottom: 40px;
    letter-spacing: 2px;
}}

.elements-container {{
    display: flex;
    gap: 40px;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
}}

.icon-showcase {{
    text-align: center;
}}

.icon-showcase img {{
    width: 200px;
    height: 200px;
    border-radius: 50%;
    box-shadow: 0 0 40px rgba(60, 120, 220, 0.3);
    margin-bottom: 16px;
}}

.palette-section {{
    text-align: center;
}}

.palette-section img {{
    width: 480px;
    height: auto;
    border-radius: 16px;
    border: 1px solid rgba(60, 120, 220, 0.15);
}}

.element-desc {{
    margin-top: 30px;
    display: flex;
    gap: 30px;
    justify-content: center;
    flex-wrap: wrap;
}}

.element-item {{
    background: rgba(20, 30, 60, 0.5);
    border: 1px solid rgba(60, 120, 220, 0.1);
    border-radius: 12px;
    padding: 20px 28px;
    max-width: 220px;
}}

.element-item h4 {{
    font-size: 16px;
    font-weight: 600;
    color: #64c8ff;
    margin-bottom: 6px;
}}

.element-item p {{
    font-size: 13px;
    color: rgba(170, 185, 210, 0.6);
    line-height: 1.6;
}}

/* ===== SLIDE 6: APPLICATION ===== */
.slide-6 {{
    background: radial-gradient(ellipse at 50% 40%, rgba(30, 60, 150, 0.15) 0%, transparent 60%), #080c1a;
    padding: 60px;
}}

.slide-6 h2 {{
    font-size: 36px;
    font-weight: 700;
    margin-bottom: 12px;
    color: #e0e8f5;
}}

.slide-6 .sub {{
    font-size: 16px;
    color: rgba(150, 170, 200, 0.5);
    margin-bottom: 50px;
    letter-spacing: 2px;
}}

.app-grid {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    max-width: 800px;
    margin: 0 auto;
}}

.app-card {{
    background: rgba(20, 30, 60, 0.5);
    border: 1px solid rgba(60, 120, 220, 0.12);
    border-radius: 16px;
    padding: 30px 20px;
    text-align: center;
    transition: all 0.3s ease;
}}

.app-card:hover {{
    border-color: rgba(100, 200, 255, 0.3);
    box-shadow: 0 4px 24px rgba(60, 120, 220, 0.15);
}}

.app-card img {{
    width: 64px;
    height: 64px;
    border-radius: 14px;
    margin-bottom: 14px;
}}

.app-card h4 {{
    font-size: 15px;
    font-weight: 600;
    color: #c0d0e8;
    margin-bottom: 6px;
}}

.app-card p {{
    font-size: 12px;
    color: rgba(150, 170, 200, 0.5);
    line-height: 1.5;
}}

/* ===== SLIDE 7: THANK YOU ===== */
.slide-7 {{
    background: radial-gradient(ellipse at 50% 40%, rgba(40, 80, 180, 0.25) 0%, transparent 60%),
                radial-gradient(ellipse at 30% 70%, rgba(120, 60, 200, 0.12) 0%, transparent 50%),
                #080c1a;
}}

.slide-7 .final-logo {{
    width: 220px;
    height: 220px;
    border-radius: 50%;
    box-shadow: 0 0 60px rgba(60, 120, 220, 0.3), 0 0 120px rgba(60, 120, 220, 0.1);
    margin: 0 auto 40px;
    animation: float 6s ease-in-out infinite;
}}

.slide-7 h2 {{
    font-size: 48px;
    font-weight: 800;
    background: linear-gradient(135deg, #64c8ff 0%, #a078ff 50%, #64c8ff 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 4s linear infinite;
    margin-bottom: 20px;
}}

.slide-7 .closing {{
    font-size: 18px;
    color: rgba(150, 180, 220, 0.5);
    letter-spacing: 4px;
}}

/* Scrollbar */
::-webkit-scrollbar {{
    width: 4px;
}}
::-webkit-scrollbar-track {{
    background: transparent;
}}
::-webkit-scrollbar-thumb {{
    background: rgba(100, 200, 255, 0.3);
    border-radius: 2px;
}}

/* Responsive */
@media (max-width: 768px) {{
    .comparison-grid {{
        flex-direction: column;
        align-items: center;
    }}
    .app-grid {{
        grid-template-columns: repeat(2, 1fr);
    }}
    .slide-0 h1 {{
        font-size: 36px;
    }}
    .slide .logo-display {{
        width: 320px !important;
        height: 320px !important;
    }}
}}
</style>
</head>
<body>

<!-- Navigation Dots -->
<nav class="nav">
    <div class="nav-dot active" onclick="scrollToSlide(0)" title="Cover"></div>
    <div class="nav-dot" onclick="scrollToSlide(1)" title="Version A"></div>
    <div class="nav-dot" onclick="scrollToSlide(2)" title="Version B"></div>
    <div class="nav-dot" onclick="scrollToSlide(3)" title="Version C"></div>
    <div class="nav-dot" onclick="scrollToSlide(4)" title="Comparison"></div>
    <div class="nav-dot" onclick="scrollToSlide(5)" title="Design Elements"></div>
    <div class="nav-dot" onclick="scrollToSlide(6)" title="Application"></div>
    <div class="nav-dot" onclick="scrollToSlide(7)" title="Thank You"></div>
</nav>

<!-- Slide 0: Cover -->
<section class="slide slide-0" id="slide-0">
    <div class="slide-content">
        <img class="cover-logo" src="data:image/png;base64,{logo_icon_b64}" alt="AISee Logo">
        <h1>AISee Security</h1>
        <p class="subtitle">Brand Logo Design</p>
        <p class="tagline">渐变流光 · 盾牌守护 · 智能安全</p>
    </div>
</section>

<!-- Slide 1: Version A -->
<section class="slide slide-1" id="slide-1">
    <div class="slide-content">
        <p class="version-label">Version A</p>
        <img class="logo-display" src="data:image/png;base64,{logo_a_b64}" alt="Logo A">
        <h2>深空流光</h2>
        <p class="desc">
            深色背景搭配电光蓝流光效果，盾牌内部嵌入 AI 之眼符号。<br>
            科技感强烈，适合安全产品主品牌标识。<br>
            粒子光效环绕盾牌，象征全方位智能防护。
        </p>
    </div>
</section>

<!-- Slide 2: Version B -->
<section class="slide slide-2" id="slide-2">
    <div class="slide-content">
        <p class="version-label">Version B</p>
        <img class="logo-display" src="data:image/png;base64,{logo_b_b64}" alt="Logo B">
        <h2>极简白境</h2>
        <p class="desc">
            白色背景上的渐变盾牌，蓝紫色调过渡。<br>
            简洁优雅，适合浅色主题和文档应用。<br>
            柔和阴影与光粒子效果保持品牌一致性。
        </p>
    </div>
</section>

<!-- Slide 3: Version C -->
<section class="slide slide-3" id="slide-3">
    <div class="slide-content">
        <p class="version-label">Version C</p>
        <img class="logo-display" src="data:image/png;base64,{logo_c_b64}" alt="Logo C">
        <h2>极光幻境</h2>
        <p class="desc">
            极光背景效果搭配增强版流光盾牌。<br>
            蓝紫渐变光带从盾牌向外辐射，最具视觉冲击力。<br>
            适合品牌展示、发布会、宣传海报等高光场景。
        </p>
    </div>
</section>

<!-- Slide 4: Comparison -->
<section class="slide slide-4" id="slide-4">
    <div class="slide-content">
        <h2>三版对比</h2>
        <p class="sub">COMPARISON</p>
        <div class="comparison-grid">
            <div class="comparison-card">
                <img src="data:image/png;base64,{logo_a_small_b64}" alt="A">
                <h3>深空流光</h3>
                <p>深色主题 · 电光蓝 · 科技感</p>
            </div>
            <div class="comparison-card">
                <img src="data:image/png;base64,{logo_b_small_b64}" alt="B">
                <h3>极简白境</h3>
                <p>浅色主题 · 蓝紫渐变 · 优雅</p>
            </div>
            <div class="comparison-card">
                <img src="data:image/png;base64,{logo_c_small_b64}" alt="C">
                <h3>极光幻境</h3>
                <p>极光效果 · 全彩流光 · 震撼</p>
            </div>
        </div>
    </div>
</section>

<!-- Slide 5: Design Elements -->
<section class="slide slide-5" id="slide-5">
    <div class="slide-content">
        <h2>设计元素</h2>
        <p class="sub">DESIGN ELEMENTS</p>
        <div class="elements-container">
            <div class="icon-showcase">
                <img src="data:image/png;base64,{logo_icon_b64}" alt="Icon">
                <h3 style="color: #c0d0e8; margin-bottom: 4px;">图标版本</h3>
                <p style="font-size: 13px; color: rgba(150,170,200,0.5);">App Icon / Favicon</p>
            </div>
            <div class="palette-section">
                <img src="data:image/png;base64,{palette_b64}" alt="Palette">
                <h3 style="color: #c0d0e8; margin-top: 12px; margin-bottom: 4px;">品牌色板</h3>
                <p style="font-size: 13px; color: rgba(150,170,200,0.5);">Brand Color Palette</p>
            </div>
        </div>
        <div class="element-desc">
            <div class="element-item">
                <h4>🛡️ 盾牌</h4>
                <p>安全守护的核心符号，几何化的未来感设计</p>
            </div>
            <div class="element-item">
                <h4>👁️ AI 之眼</h4>
                <p>嵌入盾牌内部的智能之眼，象征 AI 洞察力</p>
            </div>
            <div class="element-item">
                <h4>✨ 流光粒子</h4>
                <p>环绕盾牌的光粒子效果，增强动态科技感</p>
            </div>
            <div class="element-item">
                <h4>🎨 渐变色</h4>
                <p>蓝紫渐变主色调，融合冷色科技与暖色信赖</p>
            </div>
        </div>
    </div>
</section>

<!-- Slide 6: Application Scenarios -->
<section class="slide slide-6" id="slide-6">
    <div class="slide-content">
        <h2>应用场景</h2>
        <p class="sub">APPLICATION SCENARIOS</p>
        <div class="app-grid">
            <div class="app-card">
                <img src="data:image/png;base64,{logo_favicon_b64}" alt="">
                <h4>App 图标</h4>
                <p>移动端与桌面应用图标</p>
            </div>
            <div class="app-card">
                <img src="data:image/png;base64,{logo_favicon_b64}" alt="">
                <h4>网站 Favicon</h4>
                <p>浏览器标签页标识</p>
            </div>
            <div class="app-card">
                <img src="data:image/png;base64,{logo_favicon_b64}" alt="">
                <h4>社交媒体</h4>
                <p>头像与品牌主页标识</p>
            </div>
            <div class="app-card">
                <img src="data:image/png;base64,{logo_favicon_b64}" alt="">
                <h4>文档水印</h4>
                <p>报告与文档品牌标识</p>
            </div>
            <div class="app-card">
                <img src="data:image/png;base64,{logo_favicon_b64}" alt="">
                <h4>品牌周边</h4>
                <p>T恤、杯子、工牌等</p>
            </div>
            <div class="app-card">
                <img src="data:image/png;base64,{logo_favicon_b64}" alt="">
                <h4>发布会</h4>
                <p>Keynote 与宣传海报</p>
            </div>
        </div>
    </div>
</section>

<!-- Slide 7: Thank You -->
<section class="slide slide-7" id="slide-7">
    <div class="slide-content">
        <img class="final-logo" src="data:image/png;base64,{logo_icon_b64}" alt="AISee">
        <h2>Thank You</h2>
        <p class="closing">AISee · 安全看得见</p>
    </div>
</section>

<!-- Page Counter -->
<div class="page-counter">
    <span id="current-page">01</span> / <span id="total-pages">08</span>
</div>

<script>
// Scroll snap
document.documentElement.style.scrollSnapType = 'y mandatory';
document.body.style.scrollSnapType = 'y mandatory';

// Update navigation on scroll
const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.nav-dot');
const currentPage = document.getElementById('current-page');

function updateActiveSlide() {{
    const scrollY = window.scrollY;
    const viewH = window.innerHeight;
    const idx = Math.round(scrollY / viewH);
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    currentPage.textContent = String(idx + 1).padStart(2, '0');
}}

window.addEventListener('scroll', updateActiveSlide);
updateActiveSlide();

function scrollToSlide(idx) {{
    window.scrollTo({{ top: idx * window.innerHeight, behavior: 'smooth' }});
}}

// Keyboard navigation
document.addEventListener('keydown', (e) => {{
    const current = Math.round(window.scrollY / window.innerHeight);
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {{
        e.preventDefault();
        scrollToSlide(Math.min(current + 1, slides.length - 1));
    }} else if (e.key === 'ArrowUp' || e.key === 'PageUp') {{
        e.preventDefault();
        scrollToSlide(Math.max(current - 1, 0));
    }}
}});
</script>

</body>
</html>'''

    output_path = r'd:\AI\workbuddy\20260403\AISee_Logo_Design.html'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"PPT saved to: {output_path}")
    return output_path


if __name__ == '__main__':
    generate_ppt()
