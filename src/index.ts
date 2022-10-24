import FingerprintJS from '@fingerprintjs/fingerprintjs';

declare type Config = {
    application_id: string;
    locale?: string;
}

declare type TranslationValue = {
    locale: string;
    value: string;
}

declare type Translation = {
    key: string;
    values: TranslationValue[];
}

const base_url = 'https://api.apalize.com/public';

let application_id: null | string = null;
let visitor_id: null | string = null;
let user_locale: null | string = null;

let translations: null | Translation[] = null;
let missing_translations: Translation[] = [];

const slugify = (text: string) => {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-\.]+/g, '')     // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}

const setLocale = (locale: string) => {
    user_locale = locale;
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
            visitor_id: visitor_id,
            referrer: window?.document?.location?.href ?? null
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
                    values: user_locale && default_value ? [{
                        locale: user_locale,
                        value: default_value
                    }
                    ] : []
                }
            );
        }

        const translation_value = translation?.values?.find(value => value.locale === user_locale)?.value ?? null;

        let value = translation_value ?? default_value ?? key;

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
    user_locale = config.locale ?? null;

    await loadTranslations();

    const fingerprint = FingerprintJS.load();
    fingerprint.then(fp => fp.get())
        .then(result => {
            visitor_id = result.visitorId
        });

    setTimeout(pushMissingTranslations, 10000);

    return {
        t: translate,
        translate: translate,
        setLocale,
        translations: translations
    }
}
