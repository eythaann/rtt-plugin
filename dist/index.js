"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const proxyObj = (obj) => {
    const proxy = Object.create(null);
    for (const key of Object.keys(obj)) {
        const x = obj[key];
        proxy[key] = ((...args) => x.apply(obj, args));
    }
    return proxy;
};
function init(modules) {
    const ts = modules.typescript;
    function create(info) {
        const { languageService: tsLanguageService } = info;
        const print = (s) => {
            info.project.projectService.logger.info('Readable-Types:: ' + String(s));
        };
        print('readable-types-plugin loaded :D');
        const languageService = proxyObj(tsLanguageService);
        languageService.getSemanticDiagnostics = (fileName) => {
            const diagnostics = tsLanguageService.getSemanticDiagnostics(fileName);
            const sourceFile = tsLanguageService.getProgram()?.getSourceFile(fileName);
            if (!sourceFile) {
                print('SourceFile not found');
                return diagnostics;
            }
            const typeChecker = tsLanguageService.getProgram()?.getTypeChecker();
            ts.forEachChild(sourceFile, function visit(node) {
                if (ts.isCallExpression(node)) {
                    const signature = typeChecker?.getResolvedSignature(node);
                    if (signature) {
                        const returnType = typeChecker?.typeToString(typeChecker.getReturnTypeOfSignature(signature));
                        if (returnType && returnType.includes('RTT_FAIL')) {
                            diagnostics.push({
                                file: sourceFile,
                                start: node.getStart(),
                                length: node.getWidth(),
                                messageText: 'Test is failing: ' + returnType.slice(returnType.indexOf('<') + 1, -1),
                                category: ts.DiagnosticCategory.Error,
                                //@ts-ignore
                                code: 'readable-test-types',
                            });
                        }
                    }
                }
                ts.forEachChild(node, visit);
            });
            return diagnostics;
        };
        return languageService;
    }
    return { create };
}
module.exports = init;
