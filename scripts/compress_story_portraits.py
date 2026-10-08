"""Lossless runtime encoding; original authored PNG references remain untouched."""
from pathlib import Path
from PIL import Image
import hashlib

root = Path(__file__).resolve().parents[1]
target = root / 'assets/textures/story'
target.mkdir(parents=True, exist_ok=True)
for name in ['mara-velez', 'ivo-chen', 'selene-okoro']:
    source = root / 'assets/concepts/full-game-v1' / (name + '.png')
    image = Image.open(source).convert('RGBA')
    output = target / (name + '.webp')
    image.save(output, format='WEBP', lossless=True, method=6, exact=True)
    decoded = Image.open(output).convert('RGBA')
    assert decoded.size == image.size and decoded.tobytes() == image.tobytes(), name
    print(name, source.stat().st_size, output.stat().st_size, hashlib.sha256(decoded.tobytes()).hexdigest())
