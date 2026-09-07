(function () {
        var allowedThemes = [
          'noir-pink',
          'midnight-blue',
          'crimson-red',
          'royal-purple',
          'emerald-dark',
          'light-minimal',
          'green-stream',
          'orange-wave',
          'system'
        ];
        var themeBackgrounds = {
          'noir-pink': '#0a0a0c',
          'midnight-blue': '#030712',
          'crimson-red': '#070303',
          'royal-purple': '#07030f',
          'emerald-dark': '#020806',
          'light-minimal': '#f7f7fb',
          'green-stream': '#050706',
          'orange-wave': '#080604'
        };
        function syncThemeColor(themeId) {
          var themeColor = document.querySelector('meta[name="theme-color"]');
          if (themeColor) themeColor.setAttribute('content', themeBackgrounds[themeId] || '#0a0a0c');
        }
        try {
          var selectedTheme = localStorage.getItem('noirsound.theme') || 'noir-pink';
          if (allowedThemes.indexOf(selectedTheme) === -1) selectedTheme = 'noir-pink';
          var resolvedTheme = selectedTheme;
          if (selectedTheme === 'system') {
            resolvedTheme = window.matchMedia('(prefers-color-scheme: light)').matches
              ? 'light-minimal'
              : 'noir-pink';
          }
          document.documentElement.dataset.theme = resolvedTheme;
          document.documentElement.dataset.themePreference = selectedTheme;
          document.documentElement.style.colorScheme =
            resolvedTheme === 'light-minimal' ? 'light' : 'dark';
          syncThemeColor(resolvedTheme);
        } catch {
          document.documentElement.dataset.theme = 'noir-pink';
          document.documentElement.dataset.themePreference = 'noir-pink';
          syncThemeColor('noir-pink');
        }
      })();
