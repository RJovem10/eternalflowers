import type { Locale } from '@/i18n/dictionaries'

export type ReturnPolicySection = {
  title: string
  body: string
}

export type ModelFormLabels = {
  recipient: string
  declaration: string
  products: string
  orderNumber: string
  orderDate: string
  receiptDate: string
  consumerName: string
  consumerAddress: string
  date: string
  signature: string
}

export type ReturnPolicyContent = {
  title: string
  lastUpdated: string
  introduction: string
  sections: ReturnPolicySection[]
  modelFormTitle: string
  modelFormNote: string
  modelFormLabels: ModelFormLabels
  modelFormRecipientLine: string
}

/**
 * Campos reais da empresa vindos de site-settings (company group).
 * Todos opcionais — nenhum valor é inventado.
 */
export type CompanyFields = {
  companyName?: string | null
  taxId?: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
}

/**
 * Linhas de endereço/identificação da empresa (SEM companyName,
 * que é tratado separadamente no formulário). Apenas campos reais.
 */
export function buildCompanyLines(company: CompanyFields | null | undefined): string[] {
  const lines: string[] = []
  if (company?.taxId) lines.push(company.taxId)
  if (company?.address) lines.push(company.address)
  const cityLine = [company?.postalCode, company?.city].filter(Boolean).join(' ')
  if (cityLine) lines.push(cityLine)
  if (company?.country) lines.push(company.country)
  return lines
}

/**
 * Monta o texto do modelo de livre resolução com os dados reais.
 * O único fallback permitido é o nome da marca.
 * Nenhuma linha real é perdida, independentemente de companyName existir.
 */
export function buildModelFormText(
  content: ReturnPolicyContent,
  company: CompanyFields | null | undefined,
  email: string | null | undefined,
): string {
  const lines: string[] = []
  lines.push(content.modelFormRecipientLine)
  lines.push(company?.companyName || content.modelFormLabels.recipient)
  for (const line of buildCompanyLines(company)) {
    lines.push(line)
  }
  if (email) lines.push(email)
  lines.push('')
  lines.push(content.modelFormLabels.declaration)
  lines.push('')
  lines.push(content.modelFormLabels.products)
  lines.push(content.modelFormLabels.orderNumber)
  lines.push(content.modelFormLabels.orderDate)
  lines.push(content.modelFormLabels.receiptDate)
  lines.push('')
  lines.push(content.modelFormLabels.consumerName)
  lines.push(content.modelFormLabels.consumerAddress)
  lines.push('')
  lines.push(content.modelFormLabels.date)
  lines.push(content.modelFormLabels.signature)
  return lines.join('\n')
}

export const returnPolicyContent: Record<Locale, ReturnPolicyContent> = {
  pt: {
    title: 'Política de Devoluções e Reembolsos',
    lastUpdated: 'Última atualização: 28 de agosto de 2026',
    introduction:
      'A Eternal Flowers by Mar&Natur® preza pela satisfação dos seus clientes. Apresentamos abaixo a nossa política de devoluções e reembolsos, em conformidade com a legislação portuguesa e europeia aplicável.',
    sections: [
      {
        title: '1. Direito de livre resolução',
        body: 'Se adquiriu um produto através da nossa loja online, mediante contrato celebrado à distância, tem o direito de resolver o contrato sem necessidade de indicar qualquer motivo, no prazo de 14 dias de calendário, nos termos do artigo 10.º do Decreto-Lei n.º 24/2014.\n\nPara bens, o prazo de 14 dias conta-se a partir da data em que o consumidor ou um terceiro por si indicado (que não o transportador) receba fisicamente os bens.',
      },
      {
        title: '2. Como exercer o direito de livre resolução',
        body: 'Para exercer o direito de livre resolução, deve comunicar-nos a sua decisão através de uma declaração inequívoca (por exemplo, por correio eletrónico, carta ou qualquer outro meio que permita comprovar a comunicação).\n\nRecomendamos que nos contacte previamente através do email disponível nesta página para facilitar a identificação e o processamento da devolução, embora esse contacto prévio não seja obrigatório para o exercício do direito legal.\n\nPode utilizar o modelo de formulário de livre resolução disponível no final desta página, embora não seja obrigatório.',
      },
      {
        title: '3. Devolução dos artigos',
        body: 'Após comunicar a sua decisão de resolver o contrato, deve devolver os bens sem demora injustificada e, o mais tardar, no prazo de 14 dias de calendário a contar da data em que comunicou a resolução. O prazo considera-se cumprido se devolver os bens antes do término do prazo de 14 dias.',
      },
      {
        title: '4. Estado dos artigos e inspeção',
        body: 'O consumidor pode inspecionar e manusear o produto com o devido cuidado para conhecer a sua natureza, características e funcionamento, tal como faria numa loja física.\n\nNo entanto, será responsável pela eventual depreciação do valor dos bens resultante de uma manipulação que exceda o necessário para essa inspeção. Recomendamos que, sempre que possível, utilize a embalagem original para a devolução e que acondicione o produto de forma segura e adequada durante o transporte.',
      },
      {
        title: '5. Custos da devolução',
        body: 'Nas devoluções decorrentes do exercício do direito de livre resolução (por simples mudança de decisão), o consumidor suporta os custos diretos da devolução dos bens.\n\nCaso o problema seja um defeito do produto, um artigo incorreto ou uma falta de conformidade abrangida pelo regime legal aplicável, o consumidor não suporta os custos de devolução.',
      },
      {
        title: '6. Reembolsos',
        body: 'Reembolsaremos todos os pagamentos recebidos, incluindo o custo da modalidade de entrega normal e menos onerosa oferecida, sem incluir custos suplementares decorrentes da escolha de uma modalidade de entrega mais cara, no prazo máximo de 14 dias a contar da data em que formos informados da sua decisão de resolver o contrato.\n\nO reembolso será efetuado utilizando o mesmo meio de pagamento que utilizou na transação inicial, salvo acordo expresso em contrário. O reembolso não implicará quaisquer custos adicionais para o consumidor.\n\nPodemos reter o reembolso até termos recebido os bens de volta ou até o consumidor ter apresentado prova de devolução dos mesmos, consoante o que ocorrer primeiro.',
      },
      {
        title: '7. Produtos personalizados',
        body: 'Os bens confecionados de acordo com as especificações do consumidor ou manifestamente personalizados não beneficiam do direito de livre resolução, nos termos do artigo 17.º, n.º 1, alínea c) do Decreto-Lei n.º 24/2014, salvo se a Eternal Flowers acordar condições mais favoráveis.\n\nEsta exceção não elimina os direitos legais do consumidor em caso de defeito ou falta de conformidade dos produtos.',
      },
      {
        title: '8. Produtos danificados, incorretos ou não conformes',
        body: 'Se receber um produto danificado, incorreto ou que não corresponde ao que encomendou, contacte-nos de imediato através do email disponível nesta página. Iremos resolver a situação sem custos para si.\n\nAs despesas necessárias para repor a conformidade do produto não serão imputadas ao consumidor.',
      },
      {
        title: '9. Garantia legal / falta de conformidade',
        body: 'Nos termos do Decreto-Lei n.º 84/2021, a Eternal Flowers responde por qualquer falta de conformidade que se manifeste no prazo de três anos após a entrega do bem móvel. Se a falta de conformidade se manifestar nos primeiros 30 dias após a entrega, a lei prevê ainda o direito de solicitar a substituição imediata do bem ou a resolução do contrato.\n\nEm caso de falta de conformidade, o consumidor dispõe dos direitos à reposição da conformidade através de reparação ou substituição e, nas condições previstas na lei, à redução proporcional do preço ou à resolução do contrato.',
      },
      {
        title: '10. Contactos e endereço para devoluções',
        body: 'Os dados de contacto e o endereço para devoluções encontram-se abaixo. Recomendamos que nos contacte antes do envio para facilitar a identificação e processamento da devolução; esse contacto prévio não condiciona o exercício do direito legal.',
      },
      {
        title: '11. Modelo de formulário de livre resolução',
        body: 'Pode utilizar o modelo abaixo para exercer o direito de livre resolução. O uso deste modelo não é obrigatório — pode utilizar qualquer outra declaração inequívoca.',
      },
    ],
    modelFormTitle: 'Formulário de Livre Resolução',
    modelFormNote:
      'O uso deste modelo não é obrigatório. O consumidor pode utilizar qualquer outra declaração inequívoca.',
    modelFormRecipientLine: 'Destinatário:',
    modelFormLabels: {
      recipient: 'Eternal Flowers by Mar&Natur®',
      declaration: 'Declaro que pretendo exercer o direito de livre resolução relativamente ao seguinte contrato de compra dos seguintes bens:',
      products: 'Produto(s):',
      orderNumber: 'Número da encomenda:',
      orderDate: 'Data da encomenda:',
      receiptDate: 'Data de receção:',
      consumerName: 'Nome do consumidor:',
      consumerAddress: 'Endereço do consumidor:',
      date: 'Data:',
      signature: 'Assinatura (apenas se enviado em papel):',
    },
  },

  en: {
    title: 'Returns & Refunds Policy',
    lastUpdated: 'Last updated: 28 August 2026',
    introduction:
      'Eternal Flowers by Mar&Natur® values your satisfaction. Below is our returns and refunds policy, in accordance with applicable Portuguese and European legislation.',
    sections: [
      {
        title: '1. Right of withdrawal',
        body: 'If you purchased a product through our online store, by means of a distance contract, you have the right to withdraw from the contract without giving any reason within 14 calendar days, in accordance with Article 10 of Decree-Law No. 24/2014.\n\nFor goods, the 14-day period begins on the day you or a third party indicated by you (other than the carrier) physically receives the goods.',
      },
      {
        title: '2. How to exercise the right of withdrawal',
        body: 'To exercise the right of withdrawal, you must inform us of your decision by means of an unequivocal statement (for example, by email, letter, or any other means that allows you to prove the communication).\n\nWe recommend that you contact us in advance via the email provided on this page to facilitate identification and processing of the return, although prior contact is not required to exercise your legal right.\n\nYou may use the model withdrawal form available at the end of this page, although it is not mandatory.',
      },
      {
        title: '3. Returning goods',
        body: 'After communicating your decision to withdraw from the contract, you must return the goods without undue delay and no later than 14 calendar days from the date you communicated your withdrawal. The deadline is met if you send the goods back before the 14-day period expires.',
      },
      {
        title: '4. Condition of goods and inspection',
        body: 'You may inspect and handle the product with due care to ascertain its nature, characteristics, and functioning, as you would in a physical store.\n\nHowever, you will be liable for any diminished value of the goods resulting from handling beyond what is necessary to establish their nature, characteristics, and functioning. We recommend using the original packaging whenever possible and securing the product safely and adequately during transport.',
      },
      {
        title: '5. Return shipping costs',
        body: 'For returns resulting from the exercise of the right of withdrawal (change of mind), the consumer bears the direct cost of returning the goods.\n\nIf the issue is a defective product, an incorrect item, or a lack of conformity covered by the applicable legal regime, the consumer does not bear the return costs.',
      },
      {
        title: '6. Refunds',
        body: 'We will refund all payments received, including the cost of the standard least expensive delivery method offered, excluding any supplementary costs arising from your choice of a more expensive delivery method, within 14 days from the date we are informed of your decision to withdraw from the contract.\n\nRefunds will be made using the same payment method you used for the initial transaction, unless expressly agreed otherwise. The refund will not incur any additional costs for the consumer.\n\nWe may withhold the refund until we have received the goods back or you have provided proof of return shipment, whichever occurs first.',
      },
      {
        title: '7. Customised products',
        body: 'Goods made to the consumer\'s specifications or clearly personalised do not benefit from the right of withdrawal, in accordance with Article 17(1)(c) of Decree-Law No. 24/2014, unless Eternal Flowers agrees to more favourable conditions.\n\nThis exception does not affect your legal rights in the event of a defect or lack of conformity of the products.',
      },
      {
        title: '8. Damaged, incorrect or non-conforming products',
        body: 'If you receive a damaged, incorrect, or non-conforming product, please contact us immediately via the email provided on this page. We will resolve the situation at no cost to you.\n\nExpenses necessary to restore conformity of the product will not be charged to the consumer.',
      },
      {
        title: '9. Legal guarantee / lack of conformity',
        body: 'Under Decree-Law No. 84/2021, Eternal Flowers is liable for any lack of conformity that becomes apparent within three years of delivery of the goods. If the lack of conformity becomes apparent within the first 30 days after delivery, the law also provides the right to request immediate replacement of the goods or termination of the contract.\n\nIn the event of a lack of conformity, the consumer is entitled to have the goods brought into conformity through repair or replacement and, under the conditions provided by law, to a proportional price reduction or termination of the contract.',
      },
      {
        title: '10. Contacts and return address',
        body: 'The contact details and return address are set out below. We recommend that you contact us before sending the goods to facilitate identification and processing of the return; this prior contact does not affect the exercise of your legal right.',
      },
      {
        title: '11. Model withdrawal form',
        body: 'You may use the model form below to exercise your right of withdrawal. The use of this form is not mandatory — you may use any other unequivocal statement.',
      },
    ],
    modelFormTitle: 'Model Withdrawal Form',
    modelFormNote:
      'The use of this form is not mandatory. The consumer may use any other unequivocal statement.',
    modelFormRecipientLine: 'To:',
    modelFormLabels: {
      recipient: 'Eternal Flowers by Mar&Natur®',
      declaration: 'I/We hereby give notice that I/we withdraw from the contract of sale of the following goods:',
      products: 'Product(s):',
      orderNumber: 'Order number:',
      orderDate: 'Order date:',
      receiptDate: 'Date of receipt:',
      consumerName: 'Name of consumer(s):',
      consumerAddress: 'Address of consumer(s):',
      date: 'Date:',
      signature: 'Signature (only if this form is sent on paper):',
    },
  },

  es: {
    title: 'Política de Devoluciones y Reembolsos',
    lastUpdated: 'Última actualización: 28 de agosto de 2026',
    introduction:
      'Eternal Flowers by Mar&Natur® valora su satisfacción. A continuación presentamos nuestra política de devoluciones y reembolsos, de conformidad con la legislación portuguesa y europea aplicable.',
    sections: [
      {
        title: '1. Derecho de desistimiento',
        body: 'Si ha adquirido un producto a través de nuestra tienda online, mediante un contrato celebrado a distancia, tiene derecho a desistir del contrato sin necesidad de indicar motivo alguno en un plazo de 14 días naturales, de conformidad con el artículo 10 del Decreto-Ley n.º 24/2014.\n\nPara los bienes, el plazo de 14 días se computa desde la fecha en que el consumidor o un tercero por él indicado (distinto del transportista) reciba físicamente los bienes.',
      },
      {
        title: '2. Cómo ejercer el derecho de desistimiento',
        body: 'Para ejercer el derecho de desistimiento, debe comunicarnos su decisión mediante una declaración inequívoca (por ejemplo, por correo electrónico, carta o cualquier otro medio que permita acreditar la comunicación).\n\nLe recomendamos que se ponga en contacto con nosotros previamente a través del correo electrónico disponible en esta página para facilitar la identificación y el procesamiento de la devolución, aunque ese contacto previo no es obligatorio para ejercer su derecho legal.\n\nPuede utilizar el modelo de formulario de desistimiento disponible al final de esta página, aunque no es obligatorio.',
      },
      {
        title: '3. Devolución de los artículos',
        body: 'Después de comunicar su decisión de desistir del contrato, debe devolver los bienes sin demora injustificada y, a más tardar, en un plazo de 14 días naturales a partir de la fecha en que comunicó su desistimiento. El plazo se cumple si devuelve los bienes antes de que finalice el plazo de 14 días.',
      },
      {
        title: '4. Estado de los artículos e inspección',
        body: 'El consumidor puede inspeccionar y manipular el producto con el debido cuidado para conocer su naturaleza, características y funcionamiento, tal como haría en una tienda física.\n\nNo obstante, será responsable de la posible depreciación del valor de los bienes resultante de una manipulación que exceda lo necesario para dicha inspección. Recomendamos que, siempre que sea posible, utilice el embalaje original para la devolución y que acondicione el producto de forma segura y adecuada durante el transporte.',
      },
      {
        title: '5. Costes de la devolución',
        body: 'En las devoluciones derivadas del ejercicio del derecho de desistimiento (por simple cambio de opinión), el consumidor asume los costes directos de la devolución de los bienes.\n\nSi el problema es un defecto del producto, un artículo incorrecto o una falta de conformidad cubierta por el régimen legal aplicable, el consumidor no asume los costes de devolución.',
      },
      {
        title: '6. Reembolsos',
        body: 'Reembolsaremos todos los pagos recibidos, incluido el coste de la modalidad de entrega normal y menos onerosa ofrecida, sin incluir los costes suplementarios derivados de la elección de una modalidad de entrega más cara, en un plazo máximo de 14 días a partir de la fecha en que hayamos sido informados de su decisión de desistir del contrato.\n\nEl reembolso se efectuará utilizando el mismo medio de pago que utilizó en la transacción inicial, salvo acuerdo expreso en contrario. El reembolso no implicará costes adicionales para el consumidor.\n\nPodemos retener el reembolso hasta que hayamos recibido los bienes de vuelta o hasta que el consumidor haya presentado una prueba de la devolución de los mismos, lo que ocurra primero.',
      },
      {
        title: '7. Productos personalizados',
        body: 'Los bienes confeccionados según las especificaciones del consumidor o manifiestamente personalizados no se benefician del derecho de desistimiento, de conformidad con el artículo 17, apartado 1, letra c) del Decreto-Ley n.º 24/2014, salvo que Eternal Flowers acuerde condiciones más favorables.\n\nEsta excepción no elimina los derechos legales del consumidor en caso de defecto o falta de conformidad de los productos.',
      },
      {
        title: '8. Productos dañados, incorrectos o no conformes',
        body: 'Si recibe un producto dañado, incorrecto o que no corresponde a lo que encargó, póngase en contacto con nosotros inmediatamente a través del correo electrónico disponible en esta página. Resolveremos la situación sin coste alguno para usted.\n\nLos gastos necesarios para restablecer la conformidad del producto no se imputarán al consumidor.',
      },
      {
        title: '9. Garantía legal / falta de conformidad',
        body: 'En virtud del Decreto-Ley n.º 84/2021, Eternal Flowers responde por cualquier falta de conformidad que se manifieste en un plazo de tres años desde la entrega del bien mueble. Si la falta de conformidad se manifiesta en los primeros 30 días tras la entrega, la ley prevé además el derecho a solicitar la sustitución inmediata del bien o la resolución del contrato.\n\nEn caso de falta de conformidad, el consumidor dispone de los derechos a la reposición de la conformidad mediante reparación o sustitución y, en las condiciones previstas por la ley, a la reducción proporcional del precio o a la resolución del contrato.',
      },
      {
        title: '10. Contactos y dirección para devoluciones',
        body: 'Los datos de contacto y la dirección para devoluciones se indican a continuación. Le recomendamos que se ponga en contacto con nosotros antes del envío para facilitar la identificación y el procesamiento de la devolución; ese contacto previo no condiciona el ejercicio del derecho legal.',
      },
      {
        title: '11. Modelo de formulario de desistimiento',
        body: 'Puede utilizar el modelo siguiente para ejercer su derecho de desistimiento. El uso de este modelo no es obligatorio — puede utilizar cualquier otra declaración inequívoca.',
      },
    ],
    modelFormTitle: 'Formulario de Desistimiento',
    modelFormNote:
      'El uso de este modelo no es obligatorio. El consumidor puede utilizar cualquier otra declaración inequívoca.',
    modelFormRecipientLine: 'Destinatario:',
    modelFormLabels: {
      recipient: 'Eternal Flowers by Mar&Natur®',
      declaration: 'Por la presente comunico/comunicamos que desisto/desistimos del contrato de venta de los siguientes bienes:',
      products: 'Producto(s):',
      orderNumber: 'Número de pedido:',
      orderDate: 'Fecha del pedido:',
      receiptDate: 'Fecha de recepción:',
      consumerName: 'Nombre del consumidor:',
      consumerAddress: 'Dirección del consumidor:',
      date: 'Fecha:',
      signature: 'Firma (solo si se envía en papel):',
    },
  },

  it: {
    title: 'Politica di Reso e Rimborso',
    lastUpdated: 'Ultimo aggiornamento: 28 agosto 2026',
    introduction:
      'Eternal Flowers by Mar&Natur® tiene alla soddisfazione dei propri clienti. Di seguito presentiamo la nostra politica di reso e rimborso, in conformità con la legislazione portoghese ed europea applicabile.',
    sections: [
      {
        title: '1. Diritto di recesso',
        body: 'Se ha acquistato un prodotto attraverso il nostro negozio online, mediante contratto a distanza, ha il diritto di recedere dal contratto senza dover indicare alcun motivo entro 14 giorni di calendario, ai sensi dell\'articolo 10 del Decreto-Legge n. 24/2014.\n\nPer i beni, il periodo di 14 giorni decorre dal giorno in cui il consumatore o un terzo da lui indicato (diverso dal vettore) riceve fisicamente i beni.',
      },
      {
        title: '2. Come esercitare il diritto di recesso',
        body: 'Per esercitare il diritto di recesso, deve comunicarci la sua decisione tramite una dichiarazione inequivocabile (ad esempio, via email, lettera o qualsiasi altro mezzo che consenta di comprovare la comunicazione).\n\nTi consigliamo di contattarci preventivamente tramite l\'email disponibile in questa pagina per facilitare l\'identificazione e l\'elaborazione del reso, sebbene il contatto preventivo non sia obbligatorio per l\'esercizio del diritto di recesso.\n\nPuoi utilizzare il modulo tipo di recesso disponibile alla fine di questa pagina, sebbene non sia obbligatorio.',
      },
      {
        title: '3. Restituzione dei beni',
        body: 'Dopo aver comunicato la decisione di recedere dal contratto, deve restituire i beni senza indebito ritardo e, al più tardi, entro 14 giorni di calendario dalla data in cui ha comunicato il recesso. Il termine è rispettato se rispedisce i beni prima della scadenza del periodo di 14 giorni.',
      },
      {
        title: '4. Stato dei beni e ispezione',
        body: 'Il consumatore può ispezionare e maneggiare il prodotto con la dovuta cura per conoscerne la natura, le caratteristiche e il funzionamento, come farebbe in un negozio fisico.\n\nTuttavia, sarà responsabile per l\'eventuale deprezzamento del valore dei beni derivante da una manipolazione che ecceda quanto necessario per tale ispezione. Raccomandiamo di utilizzare, quando possibile, l\'imballaggio originale per la restituzione e di imballare il prodotto in modo sicuro e adeguato durante il trasporto.',
      },
      {
        title: '5. Costi della restituzione',
        body: 'Per i resi derivanti dall\'esercizio del diritto di recesso (semplice cambiamento di idea), il consumatore sostiene i costi diretti della restituzione dei beni.\n\nSe il problema è un difetto del prodotto, un articolo errato o un difetto di conformità coperto dal regime legale applicabile, il consumatore non sostiene i costi di restituzione.',
      },
      {
        title: '6. Rimborsi',
        body: 'Rimborseremo tutti i pagamenti ricevuti, incluso il costo della modalità di consegna standard meno onerosa offerta, esclusi eventuali costi supplementari derivanti dalla scelta di una modalità di consegna più costosa, entro 14 giorni dalla data in cui siamo stati informati della sua decisione di recedere dal contratto.\n\nIl rimborso sarà effettuato utilizzando lo stesso mezzo di pagamento utilizzato per la transazione iniziale, salvo diverso accordo espresso. Il rimborso non comporterà costi aggiuntivi per il consumatore.\n\nPossiamo trattenere il rimborso fino a quando non avremo ricevuto i beni indietro o fino a quando il consumatore non avrà fornito prova della restituzione, a seconda di quale evento si verifichi per primo.',
      },
      {
        title: '7. Prodotti personalizzati',
        body: 'I beni realizzati secondo le specifiche del consumatore o chiaramente personalizzati non beneficiano del diritto di recesso, ai sensi dell\'articolo 17, paragrafo 1, lettera c) del Decreto-Legge n. 24/2014, salvo che Eternal Flowers concordi condizioni più favorevoli.\n\nQuesta eccezione non elimina i diritti legali del consumatore in caso di difetto o difetto di conformità dei prodotti.',
      },
      {
        title: '8. Prodotti danneggiati, errati o non conformi',
        body: 'Se riceve un prodotto danneggiato, errato o non conforme a quanto ordinato, ci contatti immediatamente tramite l\'email disponibile in questa pagina. Risolveremo la situazione senza costi per lei.\n\nLe spese necessarie per ripristinare la conformità del prodotto non saranno addebitate al consumatore.',
      },
      {
        title: '9. Garanzia legale / difetto di conformità',
        body: 'Ai sensi del Decreto-Legge n. 84/2021, Eternal Flowers è responsabile per qualsiasi difetto di conformità che si manifesti entro tre anni dalla consegna del bene mobile. Se il difetto di conformità si manifesta nei primi 30 giorni dalla consegna, la legge prevede inoltre il diritto di richiedere la sostituzione immediata del bene o la risoluzione del contratto.\n\nIn caso di difetto di conformità, il consumatore dispone dei diritti al ripristino della conformità mediante riparazione o sostituzione e, alle condizioni previste dalla legge, alla riduzione proporzionale del prezzo o alla risoluzione del contratto.',
      },
      {
        title: '10. Contatti e indirizzo per i resi',
        body: 'I dati di contatto e l\'indirizzo per la restituzione sono indicati di seguito. Ti consigliamo di contattarci prima della spedizione per facilitare l\'identificazione e l\'elaborazione del reso; questo contatto preventivo non condiziona l\'esercizio del diritto legale.',
      },
      {
        title: '11. Modulo tipo di recesso',
        body: 'Può utilizzare il modulo tipo qui sotto per esercitare il diritto di recesso. L\'uso di questo modulo non è obbligatorio — può utilizzare qualsiasi altra dichiarazione inequivocabile.',
      },
    ],
    modelFormTitle: 'Modulo di Recesso',
    modelFormNote:
      'L\'uso di questo modulo non è obbligatorio. Il consumatore può utilizzare qualsiasi altra dichiarazione inequivocabile.',
    modelFormRecipientLine: 'Destinatario:',
    modelFormLabels: {
      recipient: 'Eternal Flowers by Mar&Natur®',
      declaration: 'Con la presente comunico/dichiariamo di recedere dal contratto di vendita dei seguenti beni:',
      products: 'Prodotto(i):',
      orderNumber: 'Numero d\'ordine:',
      orderDate: 'Data dell\'ordine:',
      receiptDate: 'Data di ricevimento:',
      consumerName: 'Nome del consumatore:',
      consumerAddress: 'Indirizzo del consumatore:',
      date: 'Data:',
      signature: 'Firma (solo se inviato su carta):',
    },
  },

  de: {
    title: 'Rückgabe & Erstattung',
    lastUpdated: 'Letzte Aktualisierung: 28. August 2026',
    introduction:
      'Eternal Flowers by Mar&Natur® legt Wert auf Ihre Zufriedenheit. Nachfolgend finden Sie unsere Rückgabe- und Erstattungsrichtlinie, in Übereinstimmung mit dem anwendbaren portugiesischen und europäischen Recht.',
    sections: [
      {
        title: '1. Widerrufsrecht',
        body: 'Wenn Sie ein Produkt über unseren Online-Shop, durch einen Fernabsatzvertrag, erworben haben, haben Sie das Recht, den Vertrag ohne Angabe von Gründen innerhalb von 14 Kalendertagen zu widerrufen, gemäß Artikel 10 des Dekret-Gesetzes Nr. 24/2014.\n\nBei Waren beginnt die 14-Tage-Frist an dem Tag, an dem Sie oder ein von Ihnen benannter Dritter (der nicht der Beförderer ist) die Waren physisch in Besitz nehmen.',
      },
      {
        title: '2. Wie Sie Ihr Widerrufsrecht ausüben',
        body: 'Um Ihr Widerrufsrecht auszuüben, müssen Sie uns über Ihre Entscheidung durch eine eindeutige Erklärung (z. B. per E-Mail, Brief oder jedes andere Mittel, das den Nachweis der Kommunikation ermöglicht) informieren.\n\nWir empfehlen, uns vorab per E-Mail (siehe Kontaktangaben auf dieser Seite) zu kontaktieren, um die Identifizierung und Bearbeitung der Rücksendung zu erleichtern. Eine vorherige Kontaktaufnahme ist jedoch für die Ausübung des gesetzlichen Widerrufsrechts nicht erforderlich.\n\nSie können das am Ende dieser Seite verfügbare Muster-Widerrufsformular verwenden, dies ist jedoch nicht verpflichtend.',
      },
      {
        title: '3. Rücksendung der Waren',
        body: 'Nachdem Sie uns Ihre Entscheidung zum Widerruf des Vertrags mitgeteilt haben, müssen Sie die Waren unverzüglich und spätestens innerhalb von 14 Kalendertagen ab dem Tag, an dem Sie uns über den Widerruf informiert haben, zurücksenden. Die Frist ist gewahrt, wenn Sie die Waren vor Ablauf der 14-Tage-Frist absenden.',
      },
      {
        title: '4. Zustand der Waren und Prüfung',
        body: 'Sie dürfen das Produkt mit der gebotenen Sorgfalt prüfen und in die Hand nehmen, um seine Art, Eigenschaften und Funktionsweise kennenzulernen, wie Sie es in einem Ladengeschäft tun würden.\n\nSie haften jedoch für einen etwaigen Wertverlust der Waren, der auf eine über das zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise der Waren hinausgehende Handhabung zurückzuführen ist. Wir empfehlen, nach Möglichkeit die Originalverpackung für die Rücksendung zu verwenden und das Produkt während des Transports sicher und angemessen zu schützen.',
      },
      {
        title: '5. Kosten der Rücksendung',
        body: 'Bei Rücksendungen aufgrund der Ausübung des Widerrufsrechts (bloße Meinungsänderung) trägt der Verbraucher die unmittelbaren Kosten der Rücksendung der Waren.\n\nHandelt es sich um einen Produktfehler, einen falschen Artikel oder eine Vertragswidrigkeit, die unter das anwendbare gesetzliche Regime fällt, trägt der Verbraucher keine Rücksendekosten.',
      },
      {
        title: '6. Rückerstattung',
        body: 'Wir erstatten alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Kosten für die Standardlieferung (günstigste angebotene Versandart), jedoch ohne zusätzliche Kosten, die daraus entstehen, dass Sie eine andere teurere Lieferart gewählt haben, spätestens innerhalb von 14 Tagen ab dem Tag, an dem wir über Ihre Entscheidung, den Vertrag zu widerrufen, informiert wurden.\n\nFür die Rückerstattung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, es wurde ausdrücklich etwas anderes vereinbart. Die Rückerstattung ist für Sie mit keinen Kosten verbunden.\n\nWir können die Rückerstattung verweigern, bis wir die Waren zurückerhalten haben oder bis Sie den Nachweis erbracht haben, dass Sie die Waren zurückgesandt haben, je nachdem, welches der frühere Zeitpunkt ist.',
      },
      {
        title: '7. Personalisierte Produkte',
        body: 'Waren, die nach Kundenspezifikationen angefertigt werden oder eindeutig personalisiert sind, sind vom Widerrufsrecht ausgeschlossen, gemäß Artikel 17 Absatz 1 Buchstabe c) des Dekret-Gesetzes Nr. 24/2014, es sei denn, Eternal Flowers vereinbart günstigere Bedingungen.\n\nDiese Ausnahme berührt nicht Ihre gesetzlichen Rechte im Falle eines Mangels oder einer Vertragswidrigkeit der Produkte.',
      },
      {
        title: '8. Beschädigte, falsche oder nicht vertragsgemäße Produkte',
        body: 'Wenn Sie ein beschädigtes, falsches oder nicht vertragsgemäßes Produkt erhalten, kontaktieren Sie uns bitte unverzüglich per E-Mail (siehe Kontaktangaben auf dieser Seite). Wir werden die Situation kostenlos für Sie klären.\n\nDie Kosten, die zur Wiederherstellung der Vertragsmäßigkeit des Produkts erforderlich sind, werden dem Verbraucher nicht in Rechnung gestellt.',
      },
      {
        title: '9. Gesetzliche Gewährleistung / Mangelhaftigkeit',
        body: 'Gemäß Dekret-Gesetz Nr. 84/2021 haftet Eternal Flowers für jede Vertragswidrigkeit, die innerhalb von drei Jahren nach Lieferung der beweglichen Sache auftritt. Wenn die Vertragswidrigkeit innerhalb der ersten 30 Tage nach Lieferung auftritt, sieht das Gesetz außerdem das Recht vor, sofortigen Ersatz oder Rücktritt vom Vertrag zu verlangen.\n\nIm Falle einer Vertragswidrigkeit steht dem Verbraucher das Recht auf Nachbesserung oder Ersatzlieferung und, unter den gesetzlich vorgesehenen Bedingungen, auf Minderung des Kaufpreises oder Rücktritt vom Vertrag zu.',
      },
      {
        title: '10. Kontakt und Rücksendeadresse',
        body: 'Die Kontaktdaten und die Rücksendeadresse sind unten aufgeführt. Wir empfehlen, uns vor dem Versand zu kontaktieren, um die Identifizierung und Bearbeitung der Rücksendung zu erleichtern; diese vorherige Kontaktaufnahme beeinträchtigt nicht die Ausübung des gesetzlichen Rechts.',
      },
      {
        title: '11. Muster-Widerrufsformular',
        body: 'Sie können das nachstehende Musterformular zur Ausübung Ihres Widerrufsrechts verwenden. Die Verwendung dieses Formulars ist nicht verpflichtend — Sie können jede andere eindeutige Erklärung verwenden.',
      },
    ],
    modelFormTitle: 'Muster-Widerrufsformular',
    modelFormNote:
      'Die Verwendung dieses Formulars nicht verpflichtend. Der Verbraucher kann jede andere eindeutige Erklärung verwenden.',
    modelFormRecipientLine: 'An:',
    modelFormLabels: {
      recipient: 'Eternal Flowers by Mar&Natur®',
      declaration: 'Hiermit widerrufe(n) ich/wir den von mir/uns abgeschlossenen Kaufvertrag über die folgenden Waren:',
      products: 'Produkt(e):',
      orderNumber: 'Bestellnummer:',
      orderDate: 'Bestelldatum:',
      receiptDate: 'Erhalten am:',
      consumerName: 'Name des/der Verbraucher(s):',
      consumerAddress: 'Anschrift des/der Verbraucher(s):',
      date: 'Datum:',
      signature: 'Unterschrift (nur bei Mitteilung auf Papier):',
    },
  },
}