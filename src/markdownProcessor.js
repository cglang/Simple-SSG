const marked = require('marked');
const hljs = require('highlight.js');
const matter = require('gray-matter');
const path = require('path');

marked.setOptions({
  highlight: function (code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    try {
      return hljs.highlight(code, { language }).value;
    } catch (e) {
      console.error(`Highlighting error for language ${lang}:`, e.message);
      return code;
    }
  },
  langPrefix: 'hljs language-'
});


let currentMarkdownProcessorFunc = async (rawContent) => {
  const { data, content } = matter(rawContent);

  const htmlContent = await marked.parse(content);

  return {
    html: htmlContent,
    data: data
  };
};


async function processMarkdown(rawContent) {
  try {
    const processed = await currentMarkdownProcessorFunc(rawContent);
    return processed;
  } catch (error) {
    console.error('Error processing Markdown:', error.message);
    throw error;
  }
}


function setMarkdownOptions(options) {
  marked.setOptions(options);
}

function setCustomMarkdownProcessor(customProcessorFunc) {
  processMarkdown = customProcessorFunc;
}


module.exports = {
  processMarkdown,
  setMarkdownOptions,
  setCustomMarkdownProcessor
};