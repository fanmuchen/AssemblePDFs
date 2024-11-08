import React, { useState } from 'react';
import { PDFDocument, rgb } from 'pdf-lib';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import { Layout, Form, Input, Button, Upload, Checkbox, Select, Spin, message, Table, theme, Divider } from 'antd';
import { DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined, InboxOutlined } from '@ant-design/icons';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import ToolkitSidebar from 'fmcnav';

import { pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'assets/pdf.worker.min.mjs',
  import.meta.url
).toString();

const { Content, Footer } = Layout;
const { Option } = Select;
const { Dragger } = Upload;

// const baseUrl = import.meta.env.VITE_APP_BASE_URL || '/';

interface FileData {
  id: number;
  file: File;
  title: string;
  pageCount: number;
}

let uniqueIdCounter = 0; // initialize a counter at a module level

const App: React.FC = () => {
  const [fileData, setFileData] = useState<FileData[]>([]);
  const [pageNumberPosition, setPageNumberPosition] = useState<'left' | 'right' | 'outside' | 'inside'>('outside');
  const [isLoading, setIsLoading] = useState(false);
  const [insertEmptyPages, setInsertEmptyPages] = useState(true);
  const [templateBuffer, setTemplateBuffer] = useState<ArrayBuffer | null>(null);
  const [tocTitle, setTocTitle] = useState('材料汇编');
  const [addPageNumbers, setAddPageNumbers] = useState(false);

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handlePdfUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0]; // We assume handling one file for simplicity.
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    setFileData((prevData) => [
      ...prevData,
      {
        id: uniqueIdCounter++, // use a counter for unique ID
        file: file,
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        pageCount: pdfDoc.getPageCount(),
      },
    ]);
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
        mergedPdf.addPage([pdf.getPage(0).getSize().width, pdf.getPage(0).getSize().height]);
      }
    }

    if (addPageNumbers) {
      const font = await mergedPdf.embedFont('Helvetica');

      mergedPdf.getPages().forEach((page, index) => {
        const { width } = page.getSize();
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
    }

    return mergedPdf;
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const mergedPdf = await mergePDFs();
      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, 'merged_document.pdf');
      setIsLoading(false);
    } catch (error) {
      console.error('Error generating document:', error);
      alert('An error occurred while generating the document. Please try again.');
      setIsLoading(false);
    }
  };

  const handleGenerateContentPage = async () => {
    if (!templateBuffer) {
      alert('Template buffer not loaded. Please upload a valid DOCX file.');
      return;
    }

    try {
      const zip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true });

      let currentPageNumber = 1;
      const catalogEntries = fileData.map((file) => {
        const entry = { title: file.title, page: currentPageNumber };
        currentPageNumber += file.pageCount;
        if (insertEmptyPages && file.pageCount % 2 !== 0) {
          currentPageNumber++;
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

  const columns = [
    {
      title: '标题', // Title
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: FileData) => (
        <Input.TextArea 
          value={text} 
          onChange={(e) => handleTitleChange(record.id, e.target.value)}
          autoSize={{ minRows: 2, maxRows: 6 }}
        />
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
      render: (_: any, record: FileData) => (
        <div>
          <Button icon={<ArrowUpOutlined />} onClick={() => handleMoveUp(record.id)} />
          <Button icon={<ArrowDownOutlined />} onClick={() => handleMoveDown(record.id)} />
          <Button type="primary" icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
        </div>
      ),
    },
    {
      title: 'PDF预览', // PDF Preview
      key: 'pdfPreview',
      render: (record: FileData) => (
        <Document
          file={record.file}
          loading={<Spin />}
        >
          <Page pageNumber={1} height={100}/> 
        </Document>
      ),
    },
  ];

  const loadDocxTemplate = async () => {
    const response = await fetch('/content-template.docx');
    const arrayBuffer = await response.arrayBuffer();
    setTemplateBuffer(arrayBuffer);
  };

  React.useEffect(() => {
    loadDocxTemplate();
  }, []);

  const onFileChange = async (file: File) => {
    await handlePdfUpload([file]);
  };

  const uploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    accept: '.pdf',
    customRequest: async (options: any) => {
      const { file, onSuccess, onError } = options;
      try {
        await onFileChange(file as File); // Cast file to File type
        onSuccess?.("ok");
      } catch (error) {
        onError?.(error);
      }
    },
    onChange(info: any) {
      const { status } = info.file;
      if (status === 'done') {
        message.success(`${info.file.name} 文件上传成功。`);
      } else if (status === 'error') {
        message.error(`${info.file.name} 文件上传失败。`);
      }
    },
    onDrop(e: React.DragEvent<HTMLDivElement>) {
      console.log('Dropped files', e.dataTransfer.files);
    },
  };

  return (
      <Layout>
        <ToolkitSidebar 
          logo={`${import.meta.env.BASE_URL}logo.svg`}
          selectedKeys={['assemblepdfs']}
        />
        <Layout>
        <Content
          style={{
            padding: '24px 24px',
            maxWidth: 800,
            margin: '0 auto',
            width: '100%',
            minHeight: 'calc(100vh - 100px)',
          }}
        > 
          <div
            style={{
              padding: 24,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              margin: '0 auto',
            }}
          >
            <h2 style={{ textAlign: 'center', marginBottom: '16px' }}>PDF 编排合并工具</h2>
            <Form layout="vertical">
              <Form.Item label="上传 PDF 文件">
                <Dragger {...uploadProps}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">点击或将文件拖拽到此区域上传</p>
                  <p className="ant-upload-hint">
                    支持单个或批量上传。严禁上传国家秘密或其他禁止联网处理的文件。
                  </p>
                </Dragger>
                <div>你选定了{fileData.length}个文件</div>
              </Form.Item>
              
              <Table dataSource={fileData} columns={columns} rowKey="id" pagination={false}/>
              <Divider>生成合并的PDF</Divider>
              <Form.Item>
                <Checkbox checked={insertEmptyPages} onChange={(e) => setInsertEmptyPages(e.target.checked)}>在页数为奇数的 PDF 后插入空白页</Checkbox>
              </Form.Item>
              <Form.Item>
                <Checkbox checked={addPageNumbers} onChange={(e) => setAddPageNumbers(e.target.checked)}>
                  添加页码
                </Checkbox>
              </Form.Item>
              {addPageNumbers && (
                <Form.Item label="页码位置">
                  <Select value={pageNumberPosition} onChange={(value) => setPageNumberPosition(value as any)}>
                    <Option value="left">左侧</Option>
                    <Option value="right">右侧</Option>
                    <Option value="outside">外侧</Option>
                    <Option value="inside">内侧</Option>
                  </Select>
                </Form.Item>
              )}
              <Form.Item>
                <Button type="primary" onClick={handleSubmit} disabled={isLoading}>
                  {isLoading ? <Spin size="small" /> : '生成并下载合并的 PDF'}
                </Button>
              </Form.Item>
              <Divider>生成DOCX目录页</Divider>
              <Form.Item label="自定义目录标题">
                <Input value={tocTitle} onChange={(e) => setTocTitle(e.target.value)} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" onClick={handleGenerateContentPage}>
                  生成并下载目录页
                </Button>
              </Form.Item>
            </Form>
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          Muchen Fan ©{new Date().getFullYear()} Created by FMC
          <br/><br/>
          沪ICP备2024055006号-1
        </Footer>
        </Layout>
      </Layout>
  );
};

export default App;
