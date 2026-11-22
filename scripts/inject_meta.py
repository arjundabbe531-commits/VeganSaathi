import os, re

frontend = r'D:\VeganSaathi\frontend'

FAVICON_BLOCK = '''\
<link rel="icon" href="{base}favicon.ico" sizes="any">
<link rel="icon" href="{base}icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="{base}icons/apple-touch-icon.png">
<link rel="manifest" href="{base}manifest.json">
<meta name="theme-color" content="#2D6A4F">'''

pages = [
    ('index.html', 'https://vegansaathi-88d2f.web.app/', '', 'VeganSaathi — Vegan Community Portal for Maharashtra & India', 'Discover verified vegan-friendly places across Maharashtra and India.'),
    ('explore.html', 'https://vegansaathi-88d2f.web.app/explore.html', '', 'Explore Vegan Places — VeganSaathi', 'Find genuine vegan eateries and verified vegan-friendly places across Maharashtra.'),
    ('login.html', 'https://vegansaathi-88d2f.web.app/login.html', '', 'Login — VeganSaathi', 'Sign in to your VeganSaathi account.'),
    ('register.html', 'https://vegansaathi-88d2f.web.app/register.html', '', 'Join VeganSaathi — Register', 'Create a free account on VeganSaathi, the vegan community portal.'),
    ('profile.html', 'https://vegansaathi-88d2f.web.app/profile.html', '', 'My Profile — VeganSaathi', 'Manage your VeganSaathi profile.'),
    ('saved.html', 'https://vegansaathi-88d2f.web.app/saved.html', '', 'Saved Places — VeganSaathi', 'Your saved vegan-friendly places.'),
    ('submit-place.html', 'https://vegansaathi-88d2f.web.app/submit-place.html', '', 'Submit a Place — VeganSaathi', 'Contribute a vegan-friendly place to the community directory.'),
    ('place-details.html', 'https://vegansaathi-88d2f.web.app/place-details.html', '', 'Place Details — VeganSaathi', 'Detailed vegan verification information for this place.'),
    ('awareness/what-is-veganism.html', 'https://vegansaathi-88d2f.web.app/awareness/what-is-veganism.html', '../', 'What is Veganism? — VeganSaathi', 'Learn what veganism means, its philosophy, and how it differs from vegetarianism.'),
    ('awareness/vegetarian-vs-vegan.html', 'https://vegansaathi-88d2f.web.app/awareness/vegetarian-vs-vegan.html', '../', 'Vegetarian vs Vegan — VeganSaathi', 'Understanding the difference between vegetarian and vegan diets in an Indian context.'),
    ('awareness/misconceptions.html', 'https://vegansaathi-88d2f.web.app/awareness/misconceptions.html', '../', 'Common Misconceptions About Veganism — VeganSaathi', 'Debunking common myths and misconceptions about veganism.'),
    ('awareness/getting-started.html', 'https://vegansaathi-88d2f.web.app/awareness/getting-started.html', '../', 'Getting Started with Veganism — VeganSaathi', 'A practical guide to transitioning to a vegan lifestyle in India.'),
    ('awareness/plant-based-indian-foods.html', 'https://vegansaathi-88d2f.web.app/awareness/plant-based-indian-foods.html', '../', 'Plant-Based Indian Foods — VeganSaathi', 'Discover plant-based Indian ingredients and foods for a vegan diet.'),
    ('awareness/faq.html', 'https://vegansaathi-88d2f.web.app/awareness/faq.html', '../', 'Vegan FAQ — VeganSaathi', 'Frequently asked questions about veganism answered for the Indian context.'),
    ('awareness/ingredient-checker.html', 'https://vegansaathi-88d2f.web.app/awareness/ingredient-checker.html', '../', 'Ingredient Checker — VeganSaathi', 'Check if ingredients in your food are vegan-friendly.'),
    ('admin/dashboard.html', 'https://vegansaathi-88d2f.web.app/admin/dashboard.html', '../', 'Admin Dashboard — VeganSaathi', 'Admin management panel for VeganSaathi.'),
]

SKIP_IF_HAS = 'rel="manifest"'

for rel_path, canonical, base, og_title, og_desc in pages:
    full = os.path.join(frontend, rel_path)
    if not os.path.exists(full):
        print(f'SKIP (not found): {rel_path}')
        continue
    
    with open(full, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if SKIP_IF_HAS in content:
        print(f'SKIP (already has manifest): {rel_path}')
        continue
    
    favicon_html = FAVICON_BLOCK.format(base=base)
    canonical_html = f'<link rel="canonical" href="{canonical}">'
    og_html = f'''<meta property="og:type" content="website">
<meta property="og:site_name" content="VeganSaathi">
<meta property="og:title" content="{og_title}">
<meta property="og:description" content="{og_desc}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="https://vegansaathi-88d2f.web.app/icons/icon-512.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{og_title}">
<meta name="twitter:description" content="{og_desc}">'''
    
    inject = canonical_html + '\n' + favicon_html + '\n' + og_html
    
    if '</head>' in content:
        content = content.replace('</head>', inject + '\n</head>', 1)
        with open(full, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'UPDATED: {rel_path}')
    else:
        print(f'WARN (no </head>): {rel_path}')

print('Done.')
