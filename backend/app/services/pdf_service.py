import io
from typing import Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

class PdfService:
    @classmethod
    def generate_patient_pdf(cls, paciente: Dict[str, Any]) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        header_style = ParagraphStyle(
            'HeaderStyle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#0A3D62'),
            fontName='Helvetica-Bold',
            spaceAfter=6
        )
        sub_style = ParagraphStyle(
            'SubHeaderStyle',
            parent=styles['Heading2'],
            fontSize=13,
            textColor=colors.HexColor('#1E272C'),
            fontName='Helvetica-Bold',
            spaceAfter=10
        )
        date_header_style = ParagraphStyle(
            'DateHeaderStyle',
            parent=styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor('#0A3D62'),
            fontName='Helvetica-Bold',
            spaceBefore=12,
            spaceAfter=4
        )
        cell_style = ParagraphStyle(
            'CellStyle',
            parent=styles['Normal'],
            fontSize=8,
            leading=10,
            textColor=colors.HexColor('#1E272C'),
            fontName='Helvetica'
        )
        cell_bold = ParagraphStyle(
            'CellBold',
            parent=styles['Normal'],
            fontSize=8,
            leading=10,
            textColor=colors.HexColor('#1E272C'),
            fontName='Helvetica-Bold'
        )

        story = []

        # Título
        story.append(Paragraph("Informe Clínico – GlucoTracker", header_style))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0A3D62'), spaceAfter=10))
        story.append(Paragraph("Datos del Paciente y Registro de Glucosa", sub_style))

        # Tabla del paciente
        paciente_info = [
            [Paragraph("Nombre", cell_bold), Paragraph(str(paciente.get("nombre", "-")), cell_style)],
            [Paragraph("C.I.", cell_bold), Paragraph(str(paciente.get("ci", "-")), cell_style)],
            [Paragraph("Fecha de Nacimiento", cell_bold), Paragraph(str(paciente.get("fechaNac", "-")), cell_style)],
            [Paragraph("Género", cell_bold), Paragraph(str(paciente.get("genero", "-")), cell_style)],
            [Paragraph("Peso (kg)", cell_bold), Paragraph(str(paciente.get("peso", "-")), cell_style)],
            [Paragraph("Altura (m)", cell_bold), Paragraph(str(paciente.get("altura", "-")), cell_style)],
            [Paragraph("Actividad Física", cell_bold), Paragraph(str(paciente.get("actividadFisica", "-")), cell_style)],
            [Paragraph("Teléfono", cell_bold), Paragraph(str(paciente.get("telefono", "-")), cell_style)],
            [Paragraph("Correo", cell_bold), Paragraph(str(paciente.get("Correo") or paciente.get("correo") or "-"), cell_style)],
        ]

        table_paciente = Table(paciente_info, colWidths=[150, 390])
        table_paciente.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.7, colors.HexColor('#D0DCE5')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(table_paciente)
        story.append(Spacer(1, 15))

        # Historial
        historial = paciente.get("historial", [])
        if historial:
            for day in historial:
                fecha = day.get("fecha", "")
                story.append(Paragraph(f"📅 {fecha}", date_header_style))

                table_data = [
                    [
                        Paragraph("Hora", cell_bold),
                        Paragraph("Momento", cell_bold),
                        Paragraph("Glucosa", cell_bold),
                        Paragraph("Observación", cell_bold),
                        Paragraph("Alerta", cell_bold),
                        Paragraph("Respuesta", cell_bold),
                    ]
                ]

                registros = day.get("registros", [])
                for idx, r in enumerate(registros):
                    alerta = r.get("alerta")
                    obs = alerta.get("observacion", "-") if alerta else "-"
                    nivel = alerta.get("nivel", "-") if alerta else "-"
                    mensaje = alerta.get("mensaje", "-") if alerta else "-"

                    table_data.append([
                        Paragraph(str(r.get("hora", "-")), cell_style),
                        Paragraph(str(r.get("momento", "-")), cell_style),
                        Paragraph(str(r.get("glucosa", "-")), cell_style),
                        Paragraph(str(obs), cell_style),
                        Paragraph(str(nivel), cell_style),
                        Paragraph(str(mensaje), cell_style),
                    ])

                t_registros = Table(table_data, colWidths=[50, 80, 50, 140, 110, 110])
                t_style = [
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#EBF3F9')),
                    ('GRID', (0, 0), (-1, -1), 0.7, colors.HexColor('#D0DCE5')),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                    ('TOPPADDING', (0, 0), (-1, -1), 3),
                ]
                for r_idx in range(1, len(table_data)):
                    if r_idx % 2 == 0:
                        t_style.append(('BACKGROUND', (0, r_idx), (-1, r_idx), colors.HexColor('#F5F9FC')))
                t_registros.setStyle(TableStyle(t_style))
                story.append(t_registros)
                story.append(Spacer(1, 10))

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
