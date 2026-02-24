import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { SKIP, visit } from 'unist-util-visit';
export const allowedHTMLElements = [
    'a',
    'b',
    'blockquote',
    'br',
    'code',
    'dd',
    'del',
    'details',
    'div',
    'dl',
    'dt',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'ins',
    'kbd',
    'li',
    'ol',
    'p',
    'pre',
    'q',
    'rp',
    'rt',
    'ruby',
    's',
    'samp',
    'source',
    'span',
    'strike',
    'strong',
    'sub',
    'summary',
    'sup',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'ul',
    'var',
];
const rehypeSanitizeOptions = {
    ...defaultSchema,
    tagNames: allowedHTMLElements,
    attributes: {
        ...defaultSchema.attributes,
        div: [...(defaultSchema.attributes?.div ?? []), 'data*', ['className', '__boltArtifact__']],
    },
    strip: [],
};
export function remarkPlugins(limitedMarkdown) {
    const plugins = [remarkGfm];
    if (limitedMarkdown) {
        plugins.unshift(limitedMarkdownPlugin);
    }
    return plugins;
}
export function rehypePlugins(html) {
    const plugins = [];
    if (html) {
        plugins.push(rehypeRaw, [rehypeSanitize, rehypeSanitizeOptions]);
    }
    return plugins;
}
const limitedMarkdownPlugin = () => {
    return (tree, file) => {
        const contents = file.toString();
        visit(tree, (node, index, parent) => {
            if (index == null ||
                ['paragraph', 'text', 'inlineCode', 'code', 'strong', 'emphasis'].includes(node.type) ||
                !node.position) {
                return true;
            }
            let value = contents.slice(node.position.start.offset, node.position.end.offset);
            if (node.type === 'heading') {
                value = `\n${value}`;
            }
            parent.children[index] = {
                type: 'text',
                value,
            };
            return [SKIP, index];
        });
    };
};
//# sourceMappingURL=markdown.js.map