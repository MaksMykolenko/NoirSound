# Landing design QA — 2026-09-06

Джерело: точний `noirsound-landing-prototype/index.html` і його source parts із початкового NoirSound Web checkout. Ручна browser перевірка, без screenshot regression suite.

- До імплементації відкрито hero, statement, listening Music/Beats, creator, mobile menu і motion off прототипу.
- На 1440×900 зіставлено вихідну й інтегровану композицію: типографічна ієрархія, чорний фон, біла hero CTA, pink accent, CSS vinyl/sleeve, artwork stack і creator editor збережені. Product UI використовує чинний шрифт і auth.
- На 390×844 і 360×800 перевірено вертикальний потік, nav dialog, editor/preview, CTA, довгі локалізовані рядки; горизонтальної прокрутки сторінки не спостерігалось. На 1440×720 editor/preview досяжні без обрізаних дій.
- На 1440×1080 перевірено справжню зміну hero/listen/create variables при скролі, manifesto, interlude і creator active step. Після виправлення body overflow: scene top −76.5, sticky top 0 при scrollY 1776.5; `--listen:0.0885`. Creator перейшов із «Завантаж» до «Поділися» при `--create:0.7971`.
- Ручний перехід у Discover підтвердив cleanup route-specific html/body class і відновлення app overflow; theme `noir-pink` залишилась вибраною.
- Production adaptations: справжні API/player/auth, локальне visual preview, явні декоративні SVG, реальні legal URLs, four-language UI, довгі sticky off для коротких/mobile екранів.
- Не заявляється pixel identity через продуктовий шрифт/переклади; не перевірено фізичну екранну клавіатуру, Safari/Firefox або screen reader. Детальна functional evidence — `NOIRSOUND_LANDING_FUNCTIONAL_QA.md`.
