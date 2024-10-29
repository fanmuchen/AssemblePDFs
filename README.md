# PDF 编排工具

This application, written in React and TypeScript, allows users to upload PDF files, manage them by title, reorder them, and then merge them into a single document with options to insert empty pages and/or add page numbers. Additionally, a DOCX content page (Table of Contents) can be generated using a template file.

## Features

- Upload PDF files and manage them in a list.
- Modify file titles and reorder them within the list.
- Merge multiple PDFs into a single document.
- Option to insert empty pages after PDFs with an odd number of pages.
- Option to add page numbers on merged PDFs with customizable positioning.
- Generate a DOCX document to serve as a table of contents.
- Responsive UI built with `antd` components.
  
## Setup Instructions

### Prerequisites

Ensure you have Node.js installed on your machine (v14+ recommended).

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

### Development

To start the development server with hot module replacement:

```bash
npm run dev
```
