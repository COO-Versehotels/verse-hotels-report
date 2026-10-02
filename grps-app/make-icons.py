# Membuat ikon GRPS Dashboard dengan gaya yang sama seperti Verse Recruitment / Verse Defect:
# logo Verse asli (tidak diubah) di kartu putih + pita berwarna bertulisan nama aplikasi.
# Dipanggil oleh patch-android.js saat build. Argumen: <font.ttf>
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'mobile-app', 'android', 'app', 'src', 'main', 'res')   # ikon Verse Apps (acuan)
DST = os.path.join(HERE, 'android', 'app', 'src', 'main', 'res')
FONT = sys.argv[1]
BAND = (11, 95, 196)            # warna pita (biru dashboard GRPS)
LINES = ['GRPS', 'DASHBOARD']   # tulisan di pita
NAVY = (26, 58, 92)
K = 4
C = 450 * K

sp = Image.open(os.path.join(SRC, 'drawable-xxxhdpi', 'splash_icon.png')).convert('RGBA')
bgw = Image.new('RGBA', sp.size, (255, 255, 255, 255)); bgw.alpha_composite(sp)
bb = bgw.convert('L').point(lambda v: 255 if v < 128 else 0).getbbox()
logo = bgw.crop((bb[0] - 4, bb[1] - 4, bb[2] + 4, bb[3] + 4)).convert('RGB')

def card():
    im = Image.new('RGB', (C, C), (255, 255, 255)); d = ImageDraw.Draw(im)
    d.rectangle((0, 296 * K, C, C), fill=BAND)
    lw = 147 * K; lh = int(logo.size[1] * lw / logo.size[0])
    im.paste(logo.resize((lw, lh), Image.LANCZOS), ((C - lw) // 2, 76 * K))
    fs = (39 if len(LINES) > 1 else 43) * K
    f = ImageFont.truetype(FONT, fs); gap = int(fs * 0.07)
    cys = [351 * K, 394 * K] if len(LINES) > 1 else [373 * K]
    for t, cy in zip(LINES, cys):
        ws = [d.textlength(ch, font=f) for ch in t]; x = (C - (sum(ws) + gap * (len(t) - 1))) / 2
        for ch, w in zip(t, ws):
            d.text((x, cy), ch, font=f, fill=(255, 255, 255), anchor='lm'); x += w + gap
    m = Image.new('L', (C, C), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, C - 1, C - 1), radius=74 * K, fill=255)
    o = Image.new('RGBA', (C, C), (0, 0, 0, 0)); o.paste(im, (0, 0), m); return o

def white_bbox(im):
    r, g, b, a = im.split()
    w = Image.merge('RGB', (r, g, b)).convert('L').point(lambda v: 255 if v > 245 else 0)
    return ImageChops.multiply(w, a.point(lambda v: 255 if v > 200 else 0)).getbbox()

cd = card(); n = 0
for dens in ('mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'):
    os.makedirs(os.path.join(DST, 'mipmap-' + dens), exist_ok=True)
    for name in ('ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground'):
        base = Image.open(os.path.join(SRC, 'mipmap-' + dens, name + '.png')).convert('RGBA'); S = base.size[0]
        big = base.resize((S * 8, S * 8), Image.LANCZOS)
        x0, y0, x1, y1 = white_bbox(big)
        side = max(x1 - x0, y1 - y0); cx = (x0 + x1) // 2; cy = (y0 + y1) // 2
        if name == 'ic_launcher_foreground':
            big = Image.new('RGBA', big.size, (0, 0, 0, 0))
        else:
            a = big.split()[3]; nv = Image.new('RGBA', big.size, NAVY + (255,)); nv.putalpha(a); big = nv
        if name == 'ic_launcher_round': side = int(side * 0.76)
        big.alpha_composite(cd.resize((side, side), Image.LANCZOS), (cx - side // 2, cy - side // 2))
        big.resize((S, S), Image.LANCZOS).save(os.path.join(DST, 'mipmap-' + dens, name + '.png')); n += 1
assert n == 15
print('Ikon GRPS dibuat: %d file' % n)
