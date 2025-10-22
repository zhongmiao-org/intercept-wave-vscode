import * as fs from 'fs';
import * as path from 'path';

/**
 * Template loader utility for loading HTML templates
 * This file is excluded from test coverage as it only handles file I/O
 */
export class TemplateLoader {
    /**
     * Load an HTML template from the templates directory
     * @param templateName - Name of the template file (without .html extension)
     * @returns The template content as a string
     */
    static loadTemplate(templateName: string): string {
        const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);
        return fs.readFileSync(templatePath, 'utf-8');
    }

    /**
     * Replace placeholders in a template with actual values
     * @param template - The template string with {{PLACEHOLDER}} markers
     * @param replacements - Object with placeholder names as keys and replacement values
     * @returns The template with all placeholders replaced
     */
    static replacePlaceholders(template: string, replacements: Record<string, string>): string {
        let result = template;
        for (const [key, value] of Object.entries(replacements)) {
            const placeholder = `{{${key}}}`;
            result = result.replace(new RegExp(placeholder, 'g'), value);
        }
        return result;
    }
}
