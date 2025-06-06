export const printStyles = `
  @media print {
    .main-content {
      display: none !important;
    }
    
    .print-content {
      display: block !important;
    }

    .print-content .whitespace-pre-wrap {
      max-height: none !important;
      overflow: visible !important;
    }

    .page-break {
      break-before: page !important;
    }
  }
`;