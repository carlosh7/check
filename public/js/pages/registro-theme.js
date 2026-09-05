        (function() {
            const saved = localStorage.getItem('theme');
            let theme = 'dark';
            if (saved === 'dark' || saved === 'light') {
                theme = saved;
            } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
                theme = 'light';
            }
            document.documentElement.classList.remove('dark', 'light');
            document.documentElement.classList.add(theme);
        })();
