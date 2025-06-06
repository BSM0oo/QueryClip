from fpdf import FPDF
import markdown2
import base64
import io
from datetime import datetime
from fastapi import Response

class CustomPDF(FPDF):
    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

def export_to_pdf(content: str) -> Response:
    """
    Convert markdown content to PDF and return as a FastAPI Response.
    Handles embedded base64 images and markdown formatting.
    """
    try:
        # Convert markdown to HTML
        html_content = markdown2.markdown(content)
        
        # Create PDF
        pdf = CustomPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.set_font("Arial", size=12)
        
        # Add content
        for line in html_content.split('\n'):
            # Handle images
            if line.startswith('!['):
                try:
                    # Extract base64 image data
                    img_data = line.split('](')[1].split(')')[0]
                    if img_data.startswith('data:image'):
                        # Remove header from base64 string
                        img_data = img_data.split(',')[1]
                        # Save image to temporary file
                        img_temp = io.BytesIO(base64.b64decode(img_data))
                        pdf.image(img_temp, x=10, w=190)
                except Exception as e:
                    print(f"Error processing image: {e}")
            else:
                # Remove HTML tags and write text
                text = line.replace('<strong>', '').replace('</strong>', '')
                if text.strip():
                    pdf.multi_cell(0, 10, text)
        
        # Save to memory buffer
        pdf_buffer = io.BytesIO()
        pdf.output(pdf_buffer)
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=notes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            }
        )
    except Exception as e:
        raise Exception(f"Error generating PDF: {str(e)}")