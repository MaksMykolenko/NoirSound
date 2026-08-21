import os
from PIL import Image, ImageDraw

def generate_noirsound_icon(size, is_template=False):
    # Create image
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    scale = size / 512.0
    
    bg_color = (0, 0, 0, 0) if is_template else (9, 9, 11, 255)
    border_color = (0, 0, 0, 0) if is_template else (24, 24, 27, 255)
    accent_color = (255, 255, 255, 255) if is_template else (225, 29, 72, 255)
    center_dot_color = (255, 255, 255, 255)
    
    if not is_template:
        # Background Squircle / Rounded rect
        rx = int(140 * scale)
        pad = int(24 * scale)
        draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=rx, fill=bg_color, outline=border_color, width=max(1, int(16 * scale)))
    
    # Sound wave arcs
    cx, cy = size // 2, size // 2
    
    # Left waves
    r_outer = int(190 * scale)
    r_inner = int(120 * scale)
    stroke_outer = max(1, int(18 * scale))
    stroke_inner = max(2, int(26 * scale))
    
    # Draw arcs
    draw.arc([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer], start=125, end=235, fill=accent_color, width=stroke_outer)
    draw.arc([cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner], start=125, end=235, fill=accent_color, width=stroke_inner)
    
    # Right waves
    draw.arc([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer], start=305, end=415, fill=accent_color, width=stroke_outer)
    draw.arc([cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner], start=305, end=415, fill=accent_color, width=stroke_inner)
    
    # Center transmitter core
    r_core = max(3, int(46 * scale))
    r_inner_dot = max(1, int(22 * scale))
    draw.ellipse([cx - r_core, cy - r_core, cx + r_core, cy + r_core], fill=accent_color)
    draw.ellipse([cx - r_inner_dot, cy - r_inner_dot, cx + r_inner_dot, cy + r_inner_dot], fill=center_dot_color)
    
    return img

def main():
    icons_dir = "desktop/noirsound-connect/src-tauri/icons"
    os.makedirs(icons_dir, exist_ok=True)
    
    sizes = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "icon.png": 512,
    }
    
    for filename, size in sizes.items():
        icon = generate_noirsound_icon(size, is_template=False)
        icon.save(os.path.join(icons_dir, filename), "PNG")
        print(f"Generated {filename} ({size}x{size})")
        
    # Generate macOS Tray template icon (monochrome for light & dark menu bar)
    tray_icon = generate_noirsound_icon(32, is_template=True)
    tray_icon.save(os.path.join(icons_dir, "tray-template.png"), "PNG")
    print("Generated tray-template.png (32x32 monochrome)")
    
    # Save .ico
    icon_512 = generate_noirsound_icon(256, is_template=False)
    icon_512.save(os.path.join(icons_dir, "icon.ico"), format="ICO", sizes=[(32, 32), (64, 64), (128, 128), (256, 256)])
    print("Generated icon.ico")

if __name__ == "__main__":
    main()
