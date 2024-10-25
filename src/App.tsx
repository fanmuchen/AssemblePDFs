import React, { useState } from 'react';
import { PDFDocument, rgb } from 'pdf-lib';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import { Layout, Form, Input, Button, Upload, Checkbox, Select, Spin, message, Table, ConfigProvider } from 'antd';
import { UploadOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

const { Content } = Layout;
const { Option } = Select;

interface FileData {
  id: number;
  file: File;
  title: string;
  pageCount: number;
}

let uniqueIdCounter = 0; // initialize a counter at a module level

const App: React.FC = () => {
  const [fileData, setFileData] = useState<FileData[]>([]);
  const [docxTemplate, setDocxTemplate] = useState<File | null>(null);
  const [needContentPage, setNeedContentPage] = useState(true);
  const [pageNumberPosition, setPageNumberPosition] = useState<'left' | 'right' | 'outside' | 'inside' | 'none'>('outside');
  const [isLoading, setIsLoading] = useState(false);
  const [insertEmptyPages, setInsertEmptyPages] = useState(true);
  const [templateBuffer, setTemplateBuffer] = useState<ArrayBuffer | null>(null);
  const [tocTitle, setTocTitle] = useState('Table of Contents');

  const handlePdfUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0]; // We assume handling one file for simplicity.
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    setFileData((prevData) => [
      ...prevData,
      {
        id: `${uniqueIdCounter++}-${file.name}`, // use a combination of a counter and unique string
        file: file,
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        pageCount: pdfDoc.getPageCount(),
      },
    ]);
  };

  const handleDocxUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      setTemplateBuffer(e.target?.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(file);
    setDocxTemplate(file);
  };

  const handleTitleChange = (id: number, value: string) => {
    setFileData(prevData =>
      prevData.map(item =>
        item.id === id ? { ...item, title: value } : item
      )
    );
  };

  const handleDelete = (id: number) => {
    setFileData(prevData => prevData.filter(item => item.id !== id));
  };

  const handleMoveUp = (id: number) => {
    setFileData(prevData => {
      const index = prevData.findIndex(item => item.id === id);
      if (index > 0) {
        const newData = [...prevData];
        [newData[index - 1], newData[index]] = [newData[index], newData[index - 1]];
        return newData;
      }
      return prevData;
    });
  };

  const handleMoveDown = (id: number) => {
    setFileData(prevData => {
      const index = prevData.findIndex(item => item.id === id);
      if (index < prevData.length - 1) {
        const newData = [...prevData];
        [newData[index], newData[index + 1]] = [newData[index + 1], newData[index]];
        return newData;
      }
      return prevData;
    });
  };

  const mergePDFs = async () => {
    const mergedPdf = await PDFDocument.create();

    for (const data of fileData) {
      const pdfBytes = await data.file.arrayBuffer();
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));

      // Insert an empty page if the PDF has an odd number of pages and insertEmptyPages is true
      if (insertEmptyPages && copiedPages.length % 2 !== 0) {
        const emptyPage = mergedPdf.addPage([pdf.getPage(0).getSize().width, pdf.getPage(0).getSize().height]);
      }
    }

    const font = await mergedPdf.embedFont('Helvetica');

    mergedPdf.getPages().forEach((page, index) => {
      if (pageNumberPosition === 'none') return;

      const { width, height } = page.getSize();
      const fontSize = 12;
      const pageNumber = `${index + 1}`;

      let x, y;
      switch (pageNumberPosition) {
        case 'left':
          x = 50;
          y = 30;
          break;
        case 'right':
          x = width - 50;
          y = 30;
          break;
        case 'outside':
          x = index % 2 === 0 ? width - 50 : 50;
          y = 30;
          break;
        case 'inside':
          x = index % 2 === 0 ? 50 : width - 50;
          y = 30;
          break;
      }

      page.drawText(pageNumber, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    });

    return mergedPdf;
  };

  const generateCatalog = async () => {
    if (!docxTemplate) {
      throw new Error('No DOCX template uploaded');
    }

    // Prepare catalog entries from fileData
    const catalogEntries = fileData.map((file, index) => ({
      title: file.title,
      page: index + 1 // Assuming sequential numbering
    }));

    const templateContent = await docxTemplate.arrayBuffer();
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render({ entries: catalogEntries }); // Use catalogEntries here

    const generatedDoc = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    return generatedDoc;
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const mergedPdf = await mergePDFs();
      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, 'merged_document_with_catalog.pdf');
      setIsLoading(false);
    } catch (error) {
      console.error('Error generating document:', error);
      alert('An error occurred while generating the document. Please try again.');
      setIsLoading(false);
    }
  };

  const handleGenerateContentPage = async () => {
    if(!templateBuffer) {
      alert('Template buffer not loaded. Please upload a valid DOCX file.');
      return;
    }

    try {
      const zip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true });

      // Calculate page numbers taking into account empty pages
      let currentPageNumber = 1;
      const catalogEntries = fileData.map((file, index) => {
        const entry = { title: file.title, page: currentPageNumber };
        currentPageNumber += file.pageCount;
        if (insertEmptyPages && file.pageCount % 2 !== 0) {
          currentPageNumber++; // Adding an empty page if odd number of pages
        }
        return entry;
      });

      const data = {
        title: tocTitle,
        entries: catalogEntries
      };

      doc.render(data);

      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });

      saveAs(blob, 'generated_document.docx');
    } catch (error) {
      console.error("Error generating content page:", error);
    }
  };

  const handleTocTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTocTitle(event.target.value);
  };

  const columns = [
    {
      title: '标题', // Title
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <Input value={text} onChange={(e) => handleTitleChange(record.id, e.target.value)} />
      ),
    },
    {
      title: '页数', // Page Count
      dataIndex: 'pageCount',
      key: 'pageCount',
    },
    {
      title: '动作', // Actions
      key: 'actions',
      render: (_, record) => (
        <div>
          <Button icon={<ArrowUpOutlined />} onClick={() => handleMoveUp(record.id)} />
          <Button icon={<ArrowDownOutlined />} onClick={() => handleMoveDown(record.id)} />
          <Button type="primary" icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
        </div>
      ),
    },
  ];

  return (
    <ConfigProvider>
      <Layout>
        <Content style={{ padding: '50px', backgroundColor: '#f0f2f5', minHeight: '280px' }}>
          <Form layout="vertical">
            <Form.Item label="上传 PDFs">
              <Upload
                multiple
                accept=".pdf"
                customRequest={({ file, onSuccess }) => { 
                  handlePdfUpload([file as File]);
                  onSuccess?.("ok");
                }}
                showUploadList={false}
              >
                <Button icon={<UploadOutlined />} type="primary">选择 PDF 文件</Button>
              </Upload>
            </Form.Item>
            <Form.Item label="上传 DOCX 模板">
              <Upload accept=".docx" customRequest={({ file, onSuccess }) => { handleDocxUpload(file as File); onSuccess?.("ok"); }} showUploadList={false}>
                <Button icon={<UploadOutlined />}>选择 DOCX 文件</Button>
              </Upload>
            </Form.Item>
            <Table dataSource={fileData} columns={columns} rowKey="id" pagination={false} />
            <Form.Item label="页码位置">
              <Select value={pageNumberPosition} onChange={(value) => setPageNumberPosition(value as any)}>
                <Option value="none">无页码</Option>
                <Option value="left">左侧</Option>
                <Option value="right">右侧</Option>
                <Option value="outside">外侧</Option>
                <Option value="inside">内侧</Option>
              </Select>
            </Form.Item>
            <Form.Item>
              <Checkbox checked={needContentPage} onChange={(e) => setNeedContentPage(e.target.checked)}>生成目录页</Checkbox>
            </Form.Item>
            <Form.Item>
              <Checkbox checked={insertEmptyPages} onChange={(e) => setInsertEmptyPages(e.target.checked)}>在页数为奇数的 PDF 后插入空白页</Checkbox>
            </Form.Item>
            <Form.Item label="自定义目录标题">
              <Input value={tocTitle} onChange={(e) => setTocTitle(e.target.value)} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? <Spin size="small" /> : '生成并下载最终 PDF'}
              </Button>
            </Form.Item>
          </Form>
        </Content>
      </Layout>
    </ConfigProvider>
  );
};

export default App;
