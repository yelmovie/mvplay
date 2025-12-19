import { Document, Packer, Paragraph, TextRun } from 'docx';

export async function buildScriptDocx(title, script) {
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 32 })] }),
                new Paragraph({ text: '' }),

                new Paragraph({ children: [new TextRun({ text: '해설(해설자)', bold: true })] }),
                new Paragraph({ text: script.narrator_setup || '' }),
                new Paragraph({ text: '' }),

                new Paragraph({ children: [new TextRun({ text: '등장인물', bold: true })] }),
                ...(script.cast || []).map(r => new Paragraph({ text: `- ${r.role_name}: ${r.role_hint || ''}` })),
                new Paragraph({ text: '' }),

                ...(script.scenes || []).flatMap(scene => ([
                    new Paragraph({ children: [new TextRun({ text: scene.scene_title || '장면', bold: true })] }),
                    ...((scene.lines || []).map(line =>
                        new Paragraph({
                            children: [
                                new TextRun({ text: `${line.speaker}: `, bold: true }),
                                new TextRun({ text: line.text || '' }),
                            ],
                        })
                    )),
                    new Paragraph({ text: '' }),
                ])),

                new Paragraph({ children: [new TextRun({ text: '마무리 질문', bold: true })] }),
                ...((script.wrap_up?.questions || []).map(q => new Paragraph({ text: `- ${q}` }))),
            ],
        }],
    });

    const buffer = await Packer.toBuffer(doc);
    return buffer;
}
