KM 1.009.4 — մաքուր արտադրական փաթեթ

Գործարկման և installer-ի կառուցման հիմնական ֆայլերը՝
- BUILD_SETUP.cmd — Windows x64 installer-ի կառուցում,
- VERIFY_FINAL_SETUP.cmd — կառուցված Setup-ի վերջնական ստուգում,
- app — ծրագրի ամբողջական runtime ֆայլերը,
- KM_Setup_x64.nsi — installer-ի կառուցվածքը։

Հիմնական հնարավորություններ՝
- անձնակազմ, կոչումներ և անհարմար օրեր,
- հիմնական և բոլոր վերակարգային գրաֆիկներ,
- արձակուրդ, գրանցումներ, աղյուսակներ և 3 տարվա արխիվ,
- Word/Excel/PDF փոխակերպումներ և մակրոսներ,
- A4 նախադիտում, Windows printer և PDF,
- Ctrl+P և Enter տպման կառավարում,
- հայերեն, ռուսերեն և անգլերեն միջերես,
- ամբողջ ծրագրի 8–20 pt ընդհանուր տառաչափ։

Համատեղելիություն՝
- Windows 7 SP1, 8, 8.1, 10, 11 (x64 installer),
- Electron 22.3.27 — վերջին տարբերակը Win7-8.1 աջակցությամբ,
- մոնիտորներ 960×600-ից մինչև 4K / ultra-wide, 100%–200% DPI, multi-monitor,
- NSIS ManifestDPIAware + Chromium Per-Monitor DPI,
- responsive UI breakpoints 640 / 900 / 1100 / 1366 / 1920 / 2560 px։
- Win7/8/8.1՝ software render (disable-gpu suite), Win10/11՝ hardware GPU,
- force software render՝ %LOCALAPPDATA%\KM\UserData\force_software_render.txt
  կամ KM_DISABLE_GPU=1 environment variable։
- Win7 smoke test՝ WIN7_SMOKE_TEST_HY.txt
- յուրաքանչյուր գրաֆիկի առանձին հաստատող/պատասխանատու տվյալներ։

Installer-ը ներառում է app/assets-ի բոլոր ռազմական ֆոնային նկարները։
