from PIL import Image
import os
import base64

# Define paths
INPUT_PATH = r"g:\textile-stock-management\desktop\public\logo.png"
OUTPUT_PNG_PATH = r"g:\textile-stock-management\desktop\public\logo.png" # Overwrite
OUTPUT_SVG_PATH = r"g:\textile-stock-management\desktop\public\logo.svg"

def process_image():
    try:
        # Open the image
        img = Image.open(INPUT_PATH).convert("RGBA")
        datas = img.getdata()

        newData = []
        # Simple white background removal (threshold based)
        for item in datas:
            # Check if pixel is white-ish (R>240, G>240, B>240)
            if item[0] > 240 and item[1] > 240 and item[2] > 240:
                newData.append((255, 255, 255, 0)) # Make transparent
            else:
                newData.append(item)

        img.putdata(newData)
        
        # Save transparent PNG
        img.save(OUTPUT_PNG_PATH, "PNG")
        print(f"Successfully processed PNG: {OUTPUT_PNG_PATH}")

        # Create SVG wrapper
        # We read the saved PNG to base64 to embed it
        with open(OUTPUT_PNG_PATH, "rb") as image_file:
            base64_string = base64.b64encode(image_file.read()).decode('utf-8')
        
        width, height = img.size
        
        svg_content = f'''<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <image width="{width}" height="{height}" xlink:href="data:image/png;base64,{base64_string}"/>
</svg>'''
        
        with open(OUTPUT_SVG_PATH, "w") as svg_file:
            svg_file.write(svg_content)
            
        print(f"Successfully created SVG: {OUTPUT_SVG_PATH}")

    except Exception as e:
        print(f"Error processing image: {e}")

if __name__ == "__main__":
    process_image()
