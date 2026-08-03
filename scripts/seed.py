#!/usr/bin/env python3
"""
Seed Eternal Flowers via Payload REST API.
Dev server must be running on http://localhost:3457
"""
import json, os, sys, time, requests
from pathlib import Path

BASE = "http://localhost:3457/api"
HEADERS = {"Content-Type": "application/json"}
SEED_DIR = Path(__file__).parent.parent / "seed-images"

# ===== Credenciais obrigatórias (variáveis de ambiente) =====
SEED_ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL")
SEED_ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD")

if not SEED_ADMIN_EMAIL or not SEED_ADMIN_PASSWORD:
    print("ERRO: Define SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD no ambiente.")
    print("Exemplo:")
    print("  export SEED_ADMIN_EMAIL='admin@exemplo.pt'")
    print("  export SEED_ADMIN_PASSWORD='<uma-password-forte>'")
    sys.exit(1)

# Proteção contra execução acidental em produção
NODE_ENV = os.environ.get("NODE_ENV", "development")
if NODE_ENV == "production":
    print("ERRO: Este script NÃO deve ser executado em produção (NODE_ENV=production).")
    sys.exit(1)

# Login/create first user
def get_token():
    """Obtain an auth token."""
    # Try first-register (new DB)
    try:
        url = BASE.replace("/api", "/api/users/first-register")
        r = requests.post(url, json={"email": SEED_ADMIN_EMAIL, "password": SEED_ADMIN_PASSWORD}, timeout=15)
        if r.status_code == 200:
            return r.json().get("token")
    except:
        pass
    # Try login (existing user)
    try:
        url = BASE.replace("/api", "/api/users/login")
        r = requests.post(url, json={"email": SEED_ADMIN_EMAIL, "password": SEED_ADMIN_PASSWORD}, timeout=15)
        if r.status_code == 200:
            return r.json().get("token")
    except:
        pass
    print("⚠ Could not authenticate. Continuing anyway...")
    return None

TOKEN = get_token()
AUTH_HEADERS = {"Content-Type": "application/json", "Authorization": f"JWT {TOKEN}"} if TOKEN else {"Content-Type": "application/json"}

def api(path, method="GET", data=None, files=None):
    url = f"{BASE}/{path.lstrip('/')}"
    headers = AUTH_HEADERS
    if method == "GET":
        r = requests.get(url, headers=headers, timeout=15)
    elif method == "POST":
        if files:
            h = {k: v for k, v in AUTH_HEADERS.items() if k != "Content-Type"}
            r = requests.post(url, files=files, headers=h, timeout=30)
        else:
            r = requests.post(url, json=data, headers=headers, timeout=15)
    elif method == "PATCH":
        r = requests.patch(url, json=data, headers=headers, timeout=15)
    else:
        r = requests.request(method, url, json=data, headers=headers, timeout=15)
    
    if r.status_code >= 400:
        print(f"  ⚠ {method} {url} -> {r.status_code}: {r.text[:200]}")
        r.raise_for_status()
    return r.json()

def find_or_create(slug, collection, data):
    """Find or create a doc by slug."""
    docs = api(f"{collection}?where[slug][equals]={slug}")["docs"]
    if docs:
        return docs[0]["id"]
    created = api(collection, "POST", data)
    return created["doc"]["id"]

def upload_image(filename, alt=""):
    """Upload an image to media collection."""
    fpath = SEED_DIR / filename
    if not fpath.exists():
        print(f"  ⚠ {filename} not found, skipping")
        return None
    with open(fpath, "rb") as f:
        files = {
            "file": (filename, f, "image/jpeg"),
        }
        h = {k: v for k, v in AUTH_HEADERS.items() if k != "Content-Type"}
        r = requests.post(f"{BASE}/media", files=files, headers=h, timeout=30)
        if r.status_code >= 400:
            print(f"  ⚠ Upload {filename} -> {r.status_code}: {r.text[:200]}")
            return None
        return r.json()["doc"]["id"]

def main():
    print("\n━━━ ETERNAL FLOWERS — SEED via REST API ━━━\n")

    # 1. Categories
    print("📁 Categorias")
    cat_data = [
        ("colares", "Colares", "Pendentes e colares com flores verdadeiras preservadas."),
        ("brincos", "Brincos", "Brincos delicados com miniaturas botânicas."),
        ("pulseiras", "Pulseiras", "Pulseiras artesanais com elementos florais."),
        ("porta-chaves", "Porta-chaves", "Pequenas memórias que leva consigo."),
        ("molduras", "Molduras", "Molduras com flores verdadeiras."),
    ]
    cats = {}
    for slug, name, desc in cat_data:
        cats[slug] = find_or_create(slug, "categories", {"name": name, "slug": slug, "description": desc})
        print(f"  ✓ {name} (id={cats[slug]})")

    # 2. Collections
    print("\n📚 Colecções")
    coll_data = [
        ("casamentos", "Casamentos", "Para celebrar o amor.", True),
        ("dia-da-mae", "Dia da Mãe", "Memórias que florescem para sempre.", True),
        ("primavera", "Primavera", "Peças frescas e vibrantes.", True),
        ("memorias", "Memórias", "Um instante que o tempo não apaga.", True),
        ("natureza", "Natureza", "Inspirado na beleza natural.", True),
        ("edicao-limitada", "Edição Limitada", "Criações únicas em tiragem limitada.", True),
    ]
    colls = {}
    for slug, name, desc, active in coll_data:
        colls[slug] = find_or_create(slug, "collections", {"name": name, "slug": slug, "description": desc, "isActive": active})
        print(f"  ✓ {name} (id={colls[slug]})")

    # 3. Upload images
    print("\n🖼️  Media")
    media_map = {}
    image_names = [
        "hero.jpg",
        "colar-lagrima.jpg", "brincos-sorriso.jpg", "pulseira-abraco.jpg",
        "portachaves-memoria.jpg", "moldura-janela.jpg",
        "colar-beijo.jpg", "brincos-danca.jpg", "pulseira-raiz.jpg",
        "portachaves-sussurro.jpg", "moldura-eternidade.jpg",
    ]
    for fname in image_names:
        mid = upload_image(fname, fname.replace(".jpg",""))
        if mid:
            media_map[fname.replace(".jpg","").replace("-","_")] = mid
            print(f"  ✓ {fname} (id={mid})")
        time.sleep(0.1)

    # 4. Products
    print("\n🌷 Produtos")
    products = [
        {"creationName": "Lágrima de Orvalho", "scientificName": "Orquídea Vanda coerulea", "type": "permanente", "price": 89,
         "desc": "Um colar delicado como a primeira gota de orvalho da manhã.",
         "story": "Inspirado nas manhãs frescas do Minho, quando o orvalho se acumula nas pétalas das orquídeas selvagens. Cada colar é composto por uma flor verdadeira, selecionada no auge da sua beleza, e preservada artesanalmente num processo que dura várias semanas.\n\nA corrente é em aço banhado a ouro, com fecho de segurança. A peça central mede aproximadamente 3 cm de diâmetro.\n\nInclui certificado de autenticidade e embalagem premium.",
         "avail": "available", "img": "colar_lagrima", "cat": "colares", "cols": ["natureza", "edicao-limitada"]},
        {"creationName": "Sorriso da Manhã", "scientificName": "Paphiopedilum insigne", "type": "permanente", "price": 54,
         "desc": "Brincos que capturam a doçura do primeiro sorriso do dia.",
         "story": "Criados para celebrar os pequenos momentos de felicidade que iluminam o dia-a-dia. Cada par é único — as flores são selecionadas uma a uma pela Marina, garantindo que as cores e formas se complementam.\n\nHastes em prata esterlina 925 com banho de ouro. Fecho de borboleta para segurança e conforto.\n\nDiâmetro de cada brinco: aproximadamente 1,5 cm.",
         "avail": "available", "img": "brincos_sorriso", "cat": "brincos", "cols": ["primavera", "dia-da-mae"]},
        {"creationName": "Abraço Eterno", "scientificName": "Sobrália macrantha", "type": "permanente", "price": 69,
         "desc": "Uma pulseira que envolve o pulso como um abraço que o tempo não desfaz.",
         "story": "A Sobrália é carinhosamente chamada de \"orquídea abraço\" porque as suas pétalas se curvam para dentro, como braços que envolvem. Esta pulseira nasceu da vontade de traduzir esse gesto em joia.\n\nPulseira ajustável de 16 a 19 cm, em couro vegetal castanho, com flor encapsulada em resina UV. Fecho dourado com regulação.\n\nPeça ideal para oferecer a alguém especial.",
         "avail": "available", "img": "pulseira_abraco", "cat": "pulseiras", "cols": ["casamentos", "memorias"]},
        {"creationName": "Memória Doce", "scientificName": "Cambria híbrida", "type": "permanente", "price": 39,
         "desc": "Um porta-chaves que guarda uma memória tão doce quanto o aroma da Cambria.",
         "story": "A Cambria é conhecida pelas suas cores vibrantes e padrões únicos — cada flor é como uma pequena pintura da natureza. Seleccionamos os exemplares mais bonitos para criar estes porta-chaves.\n\nCápsula em resina de alta transparência, com 3 cm de diâmetro. Argola em metal banhado a ouro, resistente ao uso diário.\n\nUm detalhe que transforma um objecto funcional numa pequena obra de arte.",
         "avail": "available", "img": "portachaves_memoria", "cat": "porta-chaves", "cols": ["dia-da-mae", "memorias"]},
        {"creationName": "Janela para o Jardim", "scientificName": "Phalaenopsis amabilis", "type": "permanente", "price": 79,
         "desc": "Uma moldura que mantém vivo um pedaço de jardim.",
         "story": "Há quem diga que a Phalaenopsis se chama \"flor borboleta\" porque as suas pétalas lembram as asas de uma borboleta em voo. Esta moldura nasceu do desejo de capturar esse voo e torná-lo eterno.\n\nMoldura em madeira de carvalho certificada, com 15x15 cm. Abertura de 8x8 cm para a flor preservada. Suporte de mesa ou parede.\n\nInclui pequena placa gravada com o nome da flor e a data de criação.",
         "avail": "available", "img": "moldura_janela", "cat": "molduras", "cols": ["memorias", "natureza"]},
        {"creationName": "Beijo de Luz", "scientificName": "Laelia purpurata", "type": "exclusivo", "price": 129,
         "desc": "Um colar que captura um beijo de luz. Edição limitada e numerada.",
         "story": "A Laelia purpurata é a flor-símbolo de Santa Catarina, Brasil — a terra-natal de Marina. Esta edição especial é uma homenagem às suas raízes e à luz tropical que inspirou a sua paixão pelas flores.\n\nPingente em vidro soprado artesanalmente, com a flor preservada no interior. Corrente em ouro 18k (banho), 45 cm. Número de série gravado.\n\nEdição limitada a 30 peças numeradas.",
         "avail": "reserved", "img": "colar_beijo", "cat": "colares", "cols": ["edicao-limitada", "memorias"]},
        {"creationName": "Dança das Pétalas", "scientificName": "Orquídea Vanda tricolor", "type": "sazonal", "price": 49,
         "desc": "Brincos que dançam com o movimento. Design leve e arejado.",
         "story": "A Vanda tricolor é uma das orquídeas mais elegantes — as suas pétalas parecem dançar quando a brisa passa. Estes brincos tentam recriar essa leveza.\n\nDisponíveis apenas na Primavera e Verão, quando as Vandas estão em floração máxima. Cada flor é colhida no momento ideal.\n\nHastes em aço cirúrgico banhado a ouro rosa. Brincos de argola com 2,5 cm de diâmetro.",
         "avail": "available", "img": "brincos_danca", "cat": "brincos", "cols": ["primavera"]},
        {"creationName": "Raiz do Amor", "scientificName": "Paphiopedilum rothschildianum", "type": "exclusivo", "price": 74,
         "desc": "Uma pulseira que fala de raízes profundas. Amor que se fortalece com o tempo.",
         "story": "O Paphiopedilum rothschildianum é uma das orquídeas mais raras do mundo — originária do Monte Kinabalu, no Bornéu. A sua forma única, que lembra um sapatinho, inspirou esta pulseira.\n\nPulseira em fio de couro entrançado, com fecho de prata. A flor encapsulada mede aproximadamente 2 cm. Peça certificada com documentação da origem botânica.\n\nEdição limitada — cada pulseira é acompanhada de uma ilustração botânica da espécie.",
         "avail": "preparing", "img": "pulseira_raiz", "cat": "pulseiras", "cols": ["edicao-limitada", "casamentos"]},
        {"creationName": "Sussurro da Natureza", "scientificName": "Sobrália cattleya", "type": "sazonal", "price": 34,
         "desc": "Um porta-chaves que sussurra histórias da floresta.",
         "story": "Há qualquer coisa de mágico em encontrar uma flor silvestre durante uma caminhada. Este porta-chaves nasceu desses momentos — uma pausa no caminho, o cheiro a terra molhada, a descoberta de uma Sobrália escondida entre as folhas.\n\nCápsula em acrílico transparente, 2,5 cm. Argola dupla em metal prateado.\n\nPeça sazonal — disponível apenas durante a floração da Sobrália, entre Maio e Julho.",
         "avail": "available", "img": "portachaves_sussurro", "cat": "porta-chaves", "cols": ["natureza", "primavera"]},
        {"creationName": "Eternidade em Flor", "scientificName": "Cambria híbrida multicolor", "type": "exclusivo", "price": 99,
         "desc": "Uma moldura que guarda a eternidade. Arco-íris de pétalas preservadas.",
         "story": "Esta moldura é a peça mais ambiciosa do nosso atelier. Utilizamos pétalas de múltiplas variedades de Cambria para criar uma composição única — como um pequeno jardim eterno dentro de uma moldura.\n\nCada peça é composta por 5 a 7 flores diferentes, dispostas à mão pela Marina. O processo de preservação e montagem leva até 3 semanas.\n\nMoldura em carvalho maciço, 20x20 cm, com passe-partout duplo. Inclui suporte de mesa e sistema de suspensão na parede.\n\nPeça numerada e certificada — nunca mais de 10 unidades por série.",
         "avail": "available", "img": "moldura_eternidade", "cat": "molduras", "cols": ["edicao-limitada", "memorias"]},
    ]

    prod_ids = []
    for p in products:
        pid = api("flowers", "POST", {
            "namePt": p["creationName"],
            "creationName": p["creationName"],
            "scientificName": p["scientificName"],
            "productType": p["type"],
            "price": p["price"],
            "descriptionPt": p["desc"],
            "story": p["story"],
            "image": media_map.get(p["img"]),
            "category": cats[p["cat"]],
            "collections": [colls[c] for c in p["cols"] if c in colls],
            "availability": p["avail"],
        })
        prod_ids.append(pid["doc"]["id"])
        print(f"  ✓ {p['creationName']} ({p['price']}€) [id={pid['doc']['id']}]")

    # 5. Homepage global
    print("\n🏠 Homepage")
    hero_id = media_map.get("hero")
    
    api("globals/homepage", "POST", {
        "hero": {
            "heroImage": hero_id,
            "heroTitle": "Eternizar um Momento,\nPreservar uma Memória",
            "heroSubtitle": "Joias artesanais com flores verdadeiras preservadas. Cada peça é uma história que o tempo não apaga. Feitas à mão em Portugal, com a delicadeza de quem sabe que a beleza merece durar para sempre.",
            "primaryButtonText": "Descobrir Catálogo",
            "primaryButtonLink": "/catalog",
            "secondaryButtonText": "Saber Mais",
            "secondaryButtonLink": "/catalog",
        },
        "realFlowers": {
            "title": "Flores Verdadeiras, Eternas",
            "subtitle": "Cada peça começa com uma flor verdadeira, selecionada no auge da sua beleza.",
        },
        "story": {
            "title": "Do Efêmero ao Eterno",
            "text": "A Eternal Flowers nasceu de um desejo simples: capturar a beleza das flores e torná-la eterna.\n\nNum mundo onde tudo passa, acreditamos que há momentos que merecem durar. Cada peça que criamos começa com uma flor verdadeira — cultivada com carinho, colhida no seu auge e preservada artesanalmente.\n\nO nosso atelier fica em Braga, Portugal. Aqui, a Marina e a sua equipa transformam flores frescas em jóias que desafiam o tempo. Não usamos moldes nem produção em série — cada peça é única, como a memória que representa.\n\nAcreditamos que a natureza nos dá os materiais mais perfeitos. O nosso trabalho é apenas guiá-los, com respeito e delicadeza, para uma nova forma de existir.",
            "image": hero_id,
        },
        "international": {
            "title": "Presença Internacional",
            "subtitle": "De Braga para o mundo. As nossas peças já viajaram para mais de 15 países.",
        },
        "instagram": {
            "title": "Siga-nos no Instagram",
            "handle": "eternal.flowers.pt",
            "text": "Acompanhe o dia-a-dia do atelier, os bastidores da criação e o carinho que colocamos em cada peça.",
        },
        "cta": {
            "title": "Pronta para Eternizar\numa Memória?",
            "subtitle": "Cada peça é feita por encomenda. Se tem uma flor especial ou uma ideia em mente, vamos criar algo único para si.",
            "buttonText": "Fale Connosco",
            "buttonLink": "/catalog",
        },
        "footer": {
            "brandDescription": "Joias artesanais com flores verdadeiras preservadas. Feitas à mão em Portugal.",
            "email": "marenatur25@gmail.com",
            "phone": "+351 964 327 241",
            "instagramUrl": "https://www.instagram.com/eternal.flowers.pt/",
            "whatsappUrl": "https://wa.me/351964327241",
        },
    })
    print("  ✓ Homepage actualizada")

    # Summary
    print("\n━━━ RESUMO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"  Categorias:  {len(cats)}")
    print(f"  Colecções:   {len(colls)}")
    print(f"  Media:       {len(media_map)}")
    print(f"  Produtos:    {len(prod_ids)}")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

if __name__ == "__main__":
    main()