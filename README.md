# PDF 编排工具 / PDF Assembler

## 演示 / Demo
https://tool.muchen.fan/assemblepdfs/

## 简介 / Introduction
该应用程序是用 React 和 TypeScript 编写的，允许用户上传 PDF 文件，按标题管理、重新排序它们，然后将其合并为一个文档，并可以选择插入空白页和/或添加页码。此外，还可以使用模板文件生成 DOCX 目录（目录页）。

This application, written in React and TypeScript, allows users to upload PDF files, manage them by title, reorder them, and then merge them into a single document with options to insert empty pages and/or add page numbers. Additionally, a DOCX content page (Table of Contents) can be generated using a template file.

## 功能 / Features

- 上传 PDF 文件并将其管理在一个列表中。
- 修改文件标题并在列表中重新排序它们。
- 将多个 PDF 合并为一个文档。
- 可选择在页数为奇数的 PDF 后插入空白页。
- 可选择在合并的 PDF 上添加页码，支持自定义位置。
- 生成一个 DOCX 文档作为目录页。
- 使用 `antd` 组件构建的响应式 UI。

- Upload PDF files and manage them in a list.
- Modify file titles and reorder them within the list.
- Merge multiple PDFs into a single document.
- Option to insert empty pages after PDFs with an odd number of pages.
- Option to add page numbers on merged PDFs with customizable positioning.
- Generate a DOCX document to serve as a table of contents.
- Responsive UI built with `antd` components.

## 安装说明 / Setup Instructions

### 先决条件 / Prerequisites

确保您的计算机上已安装 Node.js（推荐 v14+）。

Ensure you have Node.js installed on your machine (v14+ recommended).

### 安装 / Installation

1. 克隆该仓库:  
   Clone the repository:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. 安装依赖项:
   Install the dependencies:
   ```bash
   npm install
   ```

### 本地开发 / Local Development

启动开发服务器:
Start the development server:
```bash
npm run dev
```

### 构建 / Build

为生产环境构建项目:
Build the project for production:
```bash
npm run build
```

要预览生产构建:
To preview the production build:
```bash
npm run preview
```

### 部署 / Deployment

使用 `deploy.sh` 脚本自动化部署:
Automate the deployment using the `deploy.sh` script:
```bash
bash deploy.sh
```

这将构建项目并将编译后的文件传输到远程服务器。
This will build the project and transfer the compiled files to the remote server.
