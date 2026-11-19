import numpy as np
from PIL import Image, ImageFilter
img_path = r"C:\Users\pc\AppData\Local\Temp\claude\d16ddcc390bd5cef\d6e1a4d8-d022-40c2-b943-9a0444e23a30\images\2.png"
img = Image.open(img_path).convert("RGB")
print(img.size)
