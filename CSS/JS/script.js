const API_URL = "https://api.mymemory.translated.net/get";
const MAX_CHARS = 5000;
const CUSTOM_GRADIENT_KEY = "translator-custom-gradient";

const MAX_BYTES_PER_REQUEST = 450;

// true = Spanish -> English, false = English -> Spanish
let isSpanishToEnglish = true;

const elements = {
    body: document.body,
    themeBtn: document.getElementById("theme-btn"),
    gradientPalette: document.getElementById("gradient-palette"),
    gradientOptions: document.querySelectorAll(".gradient-option"),
    customGradientColor: document.getElementById("custom-gradient-color"),
    swapBtn: document.getElementById("swap-btn"),
    sourceLang: document.getElementById("source-lang"),
    targetLang: document.getElementById("target-lang"),
    sourceTitle: document.getElementById("source-title"),
    targetTitle: document.getElementById("target-title"),
    sourceText: document.getElementById("source-text"),
    targetText: document.getElementById("target-text"),
    translateBtn: document.getElementById("translate-btn"),
    clearBtn: document.getElementById("clear-btn"),
    copyBtn: document.getElementById("copy-btn"),
    charCount: document.getElementById("char-count"),
    statusText: document.getElementById("status-text"),
    translationState: document.getElementById("translation-state")
};

const gradientNames = {
    ocean: "Océano",
    sunset: "Atardecer",
    violet: "Violeta",
    emerald: "Esmeralda",
    berry: "Frambuesa",
    midnight: "Medianoche"
};

function togglePalette() {
    const isOpen = elements.gradientPalette.classList.toggle("open");
    elements.themeBtn.setAttribute("aria-expanded", String(isOpen));
}

function closePalette() {
    elements.gradientPalette.classList.remove("open");
    elements.themeBtn.setAttribute("aria-expanded", "false");
}

function applyGradient(name, save = true) {
    const validName = gradientNames[name] ? name : "ocean";

    document.body.classList.remove(
        "gradient-ocean",
        "gradient-sunset",
        "gradient-violet",
        "gradient-emerald",
        "gradient-berry",
        "gradient-midnight"
    );
    document.body.classList.add(`gradient-${validName}`);

    elements.gradientOptions.forEach((option) => {
        option.classList.toggle("active", option.dataset.gradient === validName);
    });

    elements.themeBtn.textContent = `🎨 ${gradientNames[validName]}`;

    if (save) {
        localStorage.setItem("translator-gradient", validName);
    }
}

function loadGradient() {
    const saved = localStorage.getItem("translator-gradient") || "ocean";
    applyGradient(saved, false);
}

function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    return {
        r: parseInt(clean.substring(0, 2), 16),
        g: parseInt(clean.substring(2, 4), 16),
        b: parseInt(clean.substring(4, 6), 16)
    };
}

function getReadableButtonColors(hex) {
    const { r, g, b } = hexToRgb(hex);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (luminance > 0.62) {
        return {
            bg: "rgba(0, 0, 0, 0.45)",
            hover: "rgba(0, 0, 0, 0.62)",
            border: "rgba(0, 0, 0, 0.35)",
            text: "#ffffff"
        };
    }
    return {
        bg: "rgba(255, 255, 255, 0.18)",
        hover: "rgba(255, 255, 255, 0.30)",
        border: "rgba(255, 255, 255, 0.42)",
        text: "#ffffff"
    };
}

function applyCustomGradient(color, save = true) {
    if (!/^#[0-9A-F]{6}$/i.test(color)) return;

    document.body.className = document.body.className
        .replace(/\bgradient-[^ \s]+/g, "")
        .trim();

    const buttonColors = getReadableButtonColors(color);
    document.body.style.setProperty("--bg-start", color);
    document.body.style.setProperty("--bg-end", "#000000");
    document.body.style.setProperty("--button-bg", buttonColors.bg);
    document.body.style.setProperty("--button-hover", buttonColors.hover);
    document.body.style.setProperty("--button-border", buttonColors.border);
    document.body.style.setProperty("--button-text", buttonColors.text);

    elements.gradientOptions.forEach((option) => option.classList.remove("active"));
    elements.themeBtn.textContent = "🎨 Personalizado";

    if (elements.customGradientColor.value.toLowerCase() !== color.toLowerCase()) {
        elements.customGradientColor.value = color;
    }

    if (save) {
        localStorage.setItem(CUSTOM_GRADIENT_KEY, color);
        localStorage.removeItem("translator-gradient");
    }
}

function loadCustomGradient() {
    const saved = localStorage.getItem(CUSTOM_GRADIENT_KEY);
    if (saved && /^#[0-9A-F]{6}$/i.test(saved)) {
        applyCustomGradient(saved, false);
    }
}

function updateLanguageLabels() {
    const source = isSpanishToEnglish ? "Español" : "Inglés";
    const target = isSpanishToEnglish ? "Inglés" : "Español";

    elements.sourceLang.textContent = source;
    elements.targetLang.textContent = target;
    elements.sourceTitle.textContent = source;
    elements.targetTitle.textContent = target;

    elements.sourceText.placeholder =
        isSpanishToEnglish
            ? "Escribe aquí el texto en español..."
            : "Escribe aquí el texto en inglés...";

    elements.targetText.placeholder =
        isSpanishToEnglish
            ? "La traducción al inglés aparecerá aquí..."
            : "La traducción al español aparecerá aquí...";
}

function swapLanguages() {
    const oldSource = elements.sourceText.value;
    const oldTarget = elements.targetText.value;

    isSpanishToEnglish = !isSpanishToEnglish;

    elements.sourceText.value = oldTarget;
    elements.targetText.value = oldSource;

    updateLanguageLabels();
    updateCharCount();

    elements.translationState.textContent = "Idiomas intercambiados";
    elements.statusText.textContent = "";
}

function updateCharCount() {
    elements.charCount.textContent = `${elements.sourceText.value.length} / ${MAX_CHARS}`;
}

function clearText() {
    elements.sourceText.value = "";
    elements.targetText.value = "";
    updateCharCount();
    elements.translationState.textContent = "Listo para traducir";
    elements.statusText.textContent = "";
    elements.sourceText.focus();
}

function utf8ByteLength(text) {
    return new TextEncoder().encode(text).length;
}

// Divide el contenido para respetar el límite de bytes de q de MyMemory.
function splitIntoChunks(text, maxBytes = MAX_BYTES_PER_REQUEST) {
    const words = text.match(/\S+\s*/g) || [];
    const chunks = [];
    let current = "";

    for (const word of words) {
        const candidate = current + word;

        if (utf8ByteLength(candidate) <= maxBytes) {
            current = candidate;
            continue;
        }

        if (current.trim()) {
            chunks.push(current.trim());
        }

        if (utf8ByteLength(word) > maxBytes) {
            let partial = "";
            for (const char of word) {
                const test = partial + char;
                if (utf8ByteLength(test) > maxBytes) {
                    if (partial) chunks.push(partial);
                    partial = char;
                } else {
                    partial = test;
                }
            }
            current = partial;
        } else {
            current = word;
        }
    }

    if (current.trim()) {
        chunks.push(current.trim());
    }

    return chunks;
}

async function translateChunk(text, source, target) {
    const url = new URL(API_URL);
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", `${source}|${target}`);
    url.searchParams.set("mt", "1");

    // Para una cuota mayor se puede añadir ?de=correo@dominio.com.
    // No se incluye una dirección personal por defecto.

    const response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (Number(data.responseStatus) !== 200) {
        throw new Error(data.responseDetails || "MyMemory no pudo completar la traducción.");
    }

    const translated = data?.responseData?.translatedText;

    if (!translated) {
        throw new Error("La API no devolvió una traducción válida.");
    }

    return translated;
}

async function translateText() {
    const input = elements.sourceText.value.trim();

    if (!input) {
        elements.targetText.value = "";
        elements.translationState.textContent = "Escribe algo para traducir";
        elements.statusText.textContent = "Primero introduce un texto.";
        elements.sourceText.focus();
        return;
    }

    const source = isSpanishToEnglish ? "es" : "en";
    const target = isSpanishToEnglish ? "en" : "es";

    elements.translateBtn.disabled = true;
    elements.targetText.value = "";
    elements.statusText.textContent = "Traduciendo...";
    elements.translationState.textContent = "Procesando";

    try {
        const chunks = splitIntoChunks(input);
        const translations = [];

        for (let i = 0; i < chunks.length; i++) {
            elements.statusText.textContent =
                chunks.length > 1
                    ? `Traduciendo ${i + 1} de ${chunks.length}...`
                    : "Traduciendo...";

            translations.push(await translateChunk(chunks[i], source, target));
        }

        elements.targetText.value = translations.join(" ");
        elements.statusText.textContent = "Traducción completada.";
        elements.translationState.textContent = "Completado";
    } catch (error) {
        console.error("Translation error:", error);
        elements.targetText.value = "";
        elements.statusText.textContent =
            "No se pudo conectar con MyMemory. Revisa tu conexión e inténtalo otra vez.";
        elements.translationState.textContent = "Error de traducción";
    } finally {
        elements.translateBtn.disabled = false;
    }
}

async function copyTranslation() {
    const text = elements.targetText.value.trim();

    if (!text) {
        elements.statusText.textContent = "No hay una traducción para copiar.";
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        elements.statusText.textContent = "Traducción copiada.";
    } catch {
        elements.targetText.select();
        document.execCommand("copy");
        elements.statusText.textContent = "Traducción copiada.";
    }
}

elements.themeBtn.addEventListener("click", togglePalette);

elements.gradientOptions.forEach((option) => {
    option.addEventListener("click", () => {
        localStorage.removeItem(CUSTOM_GRADIENT_KEY);
        document.body.style.removeProperty("--bg-start");
        document.body.style.removeProperty("--bg-end");
        applyGradient(option.dataset.gradient);
        closePalette();
    });
 });

if (elements.customGradientColor) {
    elements.customGradientColor.addEventListener("input", (event) => {
        applyCustomGradient(event.target.value);
        closePalette();
    });
}

document.addEventListener("click", (event) => {
    if (!event.target.closest(".theme-picker")) {
        closePalette();
    }
});

elements.swapBtn.addEventListener("click", swapLanguages);
elements.translateBtn.addEventListener("click", translateText);
elements.clearBtn.addEventListener("click", clearText);
elements.copyBtn.addEventListener("click", copyTranslation);
elements.sourceText.addEventListener("input", updateCharCount);

elements.sourceText.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        translateText();
    }
});

loadGradient();
loadCustomGradient();
updateLanguageLabels();
updateCharCount();
