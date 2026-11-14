# Convert docs screenshots (assets/shots/*.png) to compressed JPGs (assets/img) used by the PDFs.
import sys, glob, os
from PIL import Image
root = os.path.dirname(os.path.abspath(__file__))
names = sys.argv[1:] or [os.path.basename(f)[:-4] for f in glob.glob(root + '/assets/shots/*.png')]
for n in names:
    im = Image.open(f'{root}/assets/shots/{n}.png').convert('RGB')
    if im.width > 1600: im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
    im.save(f'{root}/assets/img/{n}.jpg', quality=86, optimize=True)
print('converted', len(names))
