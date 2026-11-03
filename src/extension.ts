import * as vscode from 'vscode';

/**
 * Функция активации расширения. Вызывается VS Code при старте команды.
 * Регистрирует команду 'cpp-type-optimizer.optimizeTypes' в системе.
 * 
 * @param {vscode.ExtensionContext} context Контекст расширения для управления подписками
 */
export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('cpp-type-optimizer.optimizeTypes', () => {
        // Проверяем, открыт ли редактор с файлом
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('Откройте C++ файл для оптимизации!');
            return;
        }

        const document = editor.document;
        
        // Проверка на то, что это действительно C++ файл (.cpp или .h)
        if (document.languageId !== 'cpp' && !document.fileName.endsWith('.cpp') && !document.fileName.endsWith('.h')) {
            vscode.window.showWarningMessage('Это не C++ файл!');
            return;
        }

        const text = document.getText();
        const edit = new vscode.WorkspaceEdit();
        
        /**
         * Регулярное выражение для поиска константных целочисленных объявлений в C++.
         * Ищет: модификатор (const/constexpr) + тип (int, long, long long) + имя переменной + числовое значение.
         */
        const regex = /\b(const|constexpr)\s+(long\s+long|int|long)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(-?\d+);/g;
        
        let match;
        let count = 0; // Счетчик успешно оптимизированных констант

        while ((match = regex.exec(text)) !== null) {
            const fullMatch = match[0];                  // Найденная строка целиком
            const modifier = match[1];                   // Модификатор: const или constexpr
            const currentType = match[2];                // Текущий тип данных (int, long, long long)
            const varName = match[3];                    // Имя переменной
            const value = parseInt(match[4], 10);        // Числовое значение константы

            let optimalType = currentType;

            // Определяем объективно необходимый тип по размеру числового значения
            let requiredType = 'int32_t';
            if (value >= -128 && value <= 127) {
                requiredType = 'int8_t';
            } else if (value >= -32768 && value <= 32767) {
                requiredType = 'int16_t';
            } else if (value >= -2147483648 && value <= 2147483647) {
                requiredType = 'int32_t';
            } else {
                requiredType = 'int64_t';
            }

            // Умная логика: не ломаем намерения разработчика для long / long long
            if (currentType === 'int') {
                // int можно смело оптимизировать как вниз, так и вверх
                optimalType = requiredType;
            } else if (currentType === 'long' || currentType === 'long long') {
                // Если тип уже был длинным, не превращаем его в int8_t/int16_t, 
                // но можем зафиксировать int32_t или оставить int64_t, если число реально большое
                if (requiredType === 'int64_t') {
                    optimalType = 'int64_t';
                } else {
                    optimalType = 'int32_t'; 
                }
            }

            // Если оптимальный тип отличается от текущего, производим замену
            if (optimalType !== currentType) {
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + fullMatch.length);
                const range = new vscode.Range(startPos, endPos);

                // Формируем новую строку кода с оптимизированным типом данных
                const replacement = `${modifier} ${optimalType} ${varName} = ${value};`;
                edit.replace(document.uri, range, replacement);
                count++;
            }
        }
        // Применяем собранные изменения к документу и выводим пользователю результат
        if (count > 0) {
            vscode.workspace.applyEdit(edit);
            vscode.window.showInformationMessage(`Оптимизировано констант: ${count}`);
        } else {
            vscode.window.showInformationMessage('Подходящих под оптимизацию констант не найдено.');
        }
    });

    context.subscriptions.push(disposable);
}
//Функция деактивации расширения при его отключении.
export function deactivate() {}