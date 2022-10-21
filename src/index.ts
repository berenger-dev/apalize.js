import FingerprintJS from '@fingerprintjs/fingerprintjs';

declare type Config = {
    application_id: string;
}

declare type Translation = {
    key: string;
    value: string;
}

const base_url = 'https://api.apalize.com/public';

let application_id: null | string = null;
let visitor_id: null | string = null;

let translations: null | Translation[] = null;
let missing_translations: Translation[] = [];

const slugify = (text: string) => {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

const loadTranslations = async () => {
    try {
        if (!application_id) {
            console.error("Application ID is not set");
            return;
        }

        const response = await fetch(`${base_url}/${application_id}.json`);
        const data = await response.json();

        translations = data.translations;
    } catch (e) {
        console.error(e);
    }
}

const pushMissingTranslations = () => {
    if (!missing_translations.length) {
        return;
    }

    fetch(`${base_url}/${application_id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            translations: missing_translations,
            visitor_id: visitor_id
        })
    });
}

const translate = (key: string, variables?: Record<string, string>, default_value?: string) => {
    try {
        const key_slug = slugify(key);

        if (!translations) {
            console.error("Translations are not loaded");
            return default_value ?? key;
        }

        const translation = translations.find(translation => translation.key === key_slug);

        if (!translation && !missing_translations.find(translation => translation.key === key_slug)) {
            missing_translations.push(
                {
                    key: key_slug,
                    value: key !== key_slug ? key : ''
                }
            );
        }

        let value = translation?.value ?? default_value ?? key;

        if (variables) {
            for (const variable in Object.keys(variables)) {
                value = value.replace(`{${variable}}`, variables[variable]);
            }
        }

        return value;
    } catch (e) {
        console.error(e);
        return key;
    }
}

export default async function (config: Config) {
    application_id = config.application_id;
    await loadTranslations();

    const fingerprint = FingerprintJS.load();
    fingerprint.then(fp => fp.get())
        .then(result => {
            visitor_id = result.visitorId
        });

    setTimeout(pushMissingTranslations, 10000);

    return {
        t: translate,
        translate: translate
    }
}
