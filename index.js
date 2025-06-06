// server.js

require('dotenv').config(); // Garante que as variáveis de ambiente do .env sejam carregadas
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid'); // Para gerar IDs únicos de indicação
const axios = require('axios'); // Importa o Axios para fazer requisições HTTP

const app = express();
const PORT = process.env.PORT || 3000; // Usa a porta do ambiente ou 3000

// --- Configurações do Asaas ---
// ATENÇÃO: Em produção, a chave de acesso deve vir de process.env.ASAAS_ACCESS_TOKEN
// e NUNCA ser hardcoded.
const ASAAS_ACCESS_TOKEN = process.env.ASAAS_ACCESS_TOKEN || '$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDA1MzYzMjM6OiRhYWNoX2UxYjgwYjY4LTA4OWUtNGU3ZC1hNzZhLTQ2MGQ0OGY3NjIwZA==';
const ASAAS_API_URL = 'https://www.asaas.com/api/v3'; // URL da API de produção do Asaas

// Conexão com o MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://gabrield3vsilva:mYoTxNAvOIckyNDW@cluster0.syhanoa.mongodb.net/', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Conectado ao MongoDB!'))
.catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// Middlewares
app.use(bodyParser.json());

// --- Schemas do MongoDB ---

// Schema do Usuário (Adicionado cpfCnpj para Asaas)
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // SEM CRIPTOGRAFIA! Apenas para demonstração.
    email: { type: String, required: true, unique: true },
    phone: { type: String }, // Adicionado campo de telefone para o cliente Asaas
    cpfCnpj: { type: String }, // Adicionado campo de CPF/CNPJ para o cliente Asaas
    referralLink: { type: String, unique: true },
    sponsor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    network: {
        level1: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        level2: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        level3: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        level4: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        level5: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        level6: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        level7: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        level8: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    balance: { type: Number, default: 0 },
    commissions: [{
        amount: Number,
        type: String, // 'adesao' ou 'mensalidade'
        fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        level: Number,
        date: { type: Date, default: Date.now }
    }],
    isActive: { type: Boolean, default: false }, // Ativo se pagou a adesão
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null }, // Plano ativo
    asaasCustomerId: { type: String }, // ID do cliente no Asaas
});

// Schema do Produto/Plano
const productSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    adhesionValue: { type: Number, required: true },
    monthlyValue: { type: Number, required: true },
    commissions: {
        adhesion: {
            level1: { type: Number, default: 0 },
            level2: { type: Number, default: 0 },
            level3: { type: Number, default: 0 },
            level4: { type: Number, default: 0 },
            level5: { type: Number, default: 0 },
            level6: { type: Number, default: 0 },
            level7: { type: Number, default: 0 },
            level8: { type: Number, default: 0 },
        },
        monthly: {
            level1: { type: Number, default: 0 },
            level2: { type: Number, default: 0 },
            level3: { type: Number, default: 0 },
            level4: { type: Number, default: 0 },
            level5: { type: Number, default: 0 },
            level6: { type: Number, default: 0 },
            level7: { type: Number, default: 0 },
            level8: { type: Number, default: 0 },
        },
    },
});

// Schema de Solicitação de Saque
const withdrawalRequestSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    requestDate: { type: Date, default: Date.now },
    processDate: { type: Date },
    rejectionReason: { type: String }, // Adicionado para motivo de rejeição
});

// Schema de Configurações da Empresa (White Label)
const companySettingsSchema = new mongoose.Schema({
    companyName: { type: String, default: 'Minha Empresa MMN' },
    logoUrl: { type: String, default: 'https://example.com/default-logo.png' },
    primaryColor: { type: String, default: '#007bff' },
    secondaryColor: { type: String, default: '#6c757d' },
    minWithdrawalAmount: { type: Number, default: 50 },
});

// Schema de Comunicados
const announcementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    date: { type: Date, default: Date.now },
});

// Schema de Material de Apoio
const supportMaterialSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    fileUrl: { type: String, required: true }, // URL para o arquivo (PDF, imagem, vídeo, etc.)
    fileType: { type: String, enum: ['pdf', 'image', 'video', 'presentation', 'other'], required: true },
    category: { type: String, required: true }, // Ex: Treinamentos, Produtos, Plano de Negócio
    uploadDate: { type: Date, default: Date.now },
});

// Models
const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
const CompanySettings = mongoose.model('CompanySettings', companySettingsSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const SupportMaterial = mongoose.model('SupportMaterial', supportMaterialSchema);

// --- Funções Auxiliares ---

// Função para criar ou buscar um cliente no Asaas
async function getOrCreateAsaasCustomer(user) {
    // Se o usuário já tem um ID de cliente Asaas, retorna ele
    if (user.asaasCustomerId) {
        return user.asaasCustomerId;
    }

    try {
        const customerData = {
            name: user.username, // Usar username como nome do cliente no Asaas
            email: user.email,
            phone: user.phone, // Certifique-se que o campo 'phone' existe no seu User Schema
            cpfCnpj: user.cpfCnpj, // Certifique-se que o campo 'cpfCnpj' existe no seu User Schema
            // Adicione outros campos se necessário (ex: address)
        };

        const response = await axios.post(`${ASAAS_API_URL}/customers`, customerData, {
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_ACCESS_TOKEN,
            }
        });

        // Salva o ID do cliente Asaas no seu banco de dados
        user.asaasCustomerId = response.data.id;
        await user.save();
        return response.data.id;

    } catch (error) {
        console.error('Erro ao criar/buscar cliente no Asaas:', error.response ? error.response.data : error.message);
        throw new Error('Falha ao processar cliente no Asaas.');
    }
}

// Função para criar um pagamento no Asaas
async function createAsaasPayment(customerAsaasId, value, description, billingType, creditCardToken = null) {
    const paymentData = {
        customer: customerAsaasId,
        billingType: billingType, // Ex: 'CREDIT_CARD', 'BOLETO', 'PIX'
        value: value,
        dueDate: new Date().toISOString().split('T')[0], // Data de vencimento hoje
        description: description,
        // creditCardToken: creditCardToken // Necessário se billingType for CREDIT_CARD e você estiver usando tokenização
    };

    try {
        const response = await axios.post(`${ASAAS_API_URL}/payments`, paymentData, {
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_ACCESS_TOKEN,
            }
        });
        return response.data; // Retorna os dados do pagamento criado no Asaas
    } catch (error) {
        console.error('Erro ao criar pagamento no Asaas:', error.response ? error.response.data : error.message);
        throw new Error('Falha ao criar pagamento no Asaas.');
    }
}

// Função para calcular e distribuir comissões
async function distributeCommissions(userId, commissionType, product) {
    let currentUser = await User.findById(userId);
    if (!currentUser || !currentUser.isActive) return; // Só distribui se o usuário estiver ativo

    let level = 1;
    let sponsor = await User.findById(currentUser.sponsor);

    while (sponsor && level <= 8) {
        // Verifica se o patrocinador está ativo para receber
        if (sponsor.isActive) {
            const commissionAmount = product.commissions[commissionType][`level${level}`];
            if (commissionAmount > 0) {
                sponsor.balance += commissionAmount;
                sponsor.commissions.push({
                    amount: commissionAmount,
                    type: commissionType,
                    fromUser: currentUser._id,
                    level: level,
                });
                await sponsor.save();
            }
        }
        level++;
        currentUser = sponsor;
        sponsor = await User.findById(currentUser.sponsor);
    }
}
// --- Rotas da API ---

// 0. Rota para Login (Simples - SEM SEGURANÇA)
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password }); // SEM CRIPTOGRAFIA!
    if (user) {
        // Adicione o campo 'role' se você tiver um no seu schema User
        // Por exemplo: res.status(200).json({ message: 'Login bem-sucedido!', userId: user._id, username: user.username, role: user.role });
        res.status(200).json({ message: 'Login bem-sucedido!', userId: user._id, username: user.username });
    } else {
        res.status(401).json({ message: 'Credenciais inválidas.' });
    }
});

// Rota para criar um usuário ADMIN (manual ou uma rota inicial para o primeiro admin)
// Apenas para demonstração. Em produção, isso seria um processo seguro de bootstrap.
app.post('/admin/create', async (req, res) => {
    const { username, password, email, phone, cpfCnpj } = req.body; // Adicionado phone e cpfCnpj
    try {
        // Em um sistema real, você não criaria admin por aqui ou teria um controle de acesso muito mais rigoroso.
        // E a senha seria hash (bcrypt).
        const existingUser = await User.findOne({ username }); // Verifica se o username já existe
        if (existingUser) {
            return res.status(400).json({ message: 'Nome de usuário já existe.' });
        }

        const adminUser = new User({
            username,
            password, // Lembre-se: sem hash aqui!
            email,
            phone,
            cpfCnpj,
            referralLink: `admin-${uuidv4()}`,
            // role: 'admin' // Se você adicionar um campo 'role' no seu UserSchema
        });
        await adminUser.save();
        res.status(201).json({ message: 'Admin criado com sucesso!', adminId: adminUser._id });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao criar admin', error: error.message });
    }
});

// 1. Cadastro e Indicação
app.post('/register', async (req, res) => {
    const { username, password, email, phone, cpfCnpj, sponsorReferralLink } = req.body; // Adicionado phone e cpfCnpj

    try {
        let sponsor = null;
        if (sponsorReferralLink) {
            sponsor = await User.findOne({ referralLink: sponsorReferralLink });
            if (!sponsor) {
                return res.status(400).json({ message: 'Link de indicação inválido.' });
            }
        }

        const newUser = new User({
            username,
            password,
            email,
            phone, // Salva o telefone
            cpfCnpj, // Salva o CPF/CNPJ
            referralLink: uuidv4(), // Gera um link de indicação único
            sponsor: sponsor ? sponsor._id : null,
        });

        await newUser.save();

        // Atualizar a rede do patrocinador
        if (sponsor) {
            let currentSponsor = sponsor;
            for (let level = 1; level <= 8; level++) {
                if (currentSponsor) {
                    currentSponsor.network[`level${level}`].push(newUser._id);
                    await currentSponsor.save();
                    // Encontrar o próximo patrocinador para o próximo nível
                    currentSponsor = await User.findById(currentSponsor.sponsor);
                } else {
                    break;
                }
            }
        }

        res.status(201).json({
            message: 'Usuário cadastrado com sucesso!',
            userId: newUser._id,
            username: newUser.username, // Retorna o username para facilitar o login no frontend
            referralLink: newUser.referralLink,
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Nome de usuário ou e-mail já em uso.' });
        }
        res.status(500).json({ message: 'Erro ao cadastrar usuário.', error: error.message });
    }
});

// 3. Gestão de Produtos (Apenas Admin)
app.post('/admin/products', async (req, res) => {
    // Em um sistema real, haveria uma verificação de autenticação/permissão de admin
    const { name, adhesionValue, monthlyValue, commissions } = req.body;
    try {
        const newProduct = new Product({
            name,
            adhesionValue,
            monthlyValue,
            commissions,
        });
        await newProduct.save();
        res.status(201).json({ message: 'Produto/Plano criado com sucesso!', product: newProduct });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Nome do produto já existe.' });
        }
        res.status(500).json({ message: 'Erro ao criar produto/plano.', error: error.message });
    }
});

app.put('/admin/products/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    try {
        const updatedProduct = await Product.findByIdAndUpdate(id, updates, { new: true });
        if (!updatedProduct) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }
        res.status(200).json({ message: 'Produto/Plano atualizado com sucesso!', product: updatedProduct });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar produto/plano.', error: error.message });
    }
});

app.get('/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar produtos.', error: error.message });
    }
});

// Compra de Adesão (Ativa o plano e mensalidade)
app.post('/users/:userId/buy-adhesion/:productId', async (req, res) => {
    const { userId, productId } = req.params;
    const { paymentMethod, creditCardToken } = req.body; // creditCardToken para pagamentos com cartão

    try {
        const user = await User.findById(userId);
        const product = await Product.findById(productId);

        if (!user || !product) {
            return res.status(404).json({ message: 'Usuário ou produto não encontrado.' });
        }

        if (user.isActive) {
            return res.status(400).json({ message: 'Usuário já possui um plano ativo.' });
        }

        // 1. Criar ou obter o cliente no Asaas
        const customerAsaasId = await getOrCreateAsaasCustomer(user);

        // 2. Criar o pagamento no Asaas
        let asaasPaymentResponse;
        try {
            asaasPaymentResponse = await createAsaasPayment(
                customerAsaasId,
                product.adhesionValue,
                `Pagamento de Adesão - Plano ${product.name}`,
                paymentMethod, // 'PIX', 'BOLETO', 'CREDIT_CARD'
                creditCardToken // Passa o token do cartão se for o caso
            );
            console.log('Resposta do Asaas (Adesão):', asaasPaymentResponse);
        } catch (paymentError) {
            console.error('Erro na criação do pagamento Asaas (Adesão):', paymentError.message);
            return res.status(500).json({ message: 'Falha ao iniciar pagamento da adesão no Asaas.', error: paymentError.message });
        }

        // 3. Verificar o status inicial do pagamento (para Pix/Boleto, o status inicial é PENDING)
        // Em um sistema real, você usaria Webhooks do Asaas para confirmar o status final do pagamento.
        // Para esta demonstração, vamos considerar que a criação bem-sucedida da cobrança é suficiente para prosseguir.
        // Se o paymentMethod for 'CREDIT_CARD', o status pode ser 'CONFIRMED' ou 'RECEIVED' imediatamente.
        if (asaasPaymentResponse.status === 'PENDING' || asaasPaymentResponse.status === 'CONFIRMED' || asaasPaymentResponse.status === 'RECEIVED') {
            user.isActive = true;
            user.plan = product._id;
            await user.save();

            // Distribuir comissões de adesão
            await distributeCommissions(user._id, 'adhesion', product);

            res.status(200).json({
                message: 'Adesão comprada e plano ativado com sucesso! Pagamento em processamento.',
                user,
                asaasPayment: asaasPaymentResponse // Retorna a resposta do Asaas para o frontend
            });
        } else {
            // Se o status inicial não for um dos esperados, algo deu errado no Asaas
            res.status(500).json({ message: 'Pagamento da adesão não foi processado com sucesso pelo Asaas.', asaasPayment: asaasPaymentResponse });
        }

    } catch (error) {
        console.error('Erro geral ao comprar adesão:', error.message);
        res.status(500).json({ message: 'Erro ao comprar adesão.', error: error.message });
    }
});

// Pagamento de Mensalidade
app.post('/users/:userId/pay-monthly/:productId', async (req, res) => {
    const { userId, productId } = req.params;
    const { paymentMethod, creditCardToken } = req.body; // creditCardToken para pagamentos com cartão

    try {
        const user = await User.findById(userId);
        const product = await Product.findById(productId);

        if (!user || !product) {
            return res.status(404).json({ message: 'Usuário ou produto não encontrado.' });
        }

        if (!user.isActive || user.plan.toString() !== productId) {
            return res.status(400).json({ message: 'Usuário não tem este plano ativo para pagar a mensalidade.' });
        }

        // 1. Criar ou obter o cliente no Asaas
        const customerAsaasId = await getOrCreateAsaasCustomer(user);

        // 2. Criar o pagamento no Asaas
        let asaasPaymentResponse;
        try {
            asaasPaymentResponse = await createAsaasPayment(
                customerAsaasId,
                product.monthlyValue,
                `Pagamento de Mensalidade - Plano ${product.name}`,
                paymentMethod, // 'PIX', 'BOLETO', 'CREDIT_CARD'
                creditCardToken // Passa o token do cartão se for o caso
            );
            console.log('Resposta do Asaas (Mensalidade):', asaasPaymentResponse);
        } catch (paymentError) {
            console.error('Erro na criação do pagamento Asaas (Mensalidade):', paymentError.message);
            return res.status(500).json({ message: 'Falha ao iniciar pagamento da mensalidade no Asaas.', error: paymentError.message });
        }

        // 3. Verificar o status inicial do pagamento
        if (asaasPaymentResponse.status === 'PENDING' || asaasPaymentResponse.status === 'CONFIRMED' || asaasPaymentResponse.status === 'RECEIVED') {
            // Aqui você registraria o pagamento da mensalidade (ex: em um histórico de pagamentos)
            // E possivelmente atualizar a data da próxima mensalidade.
            // Para simplicidade, apenas distribuiremos as comissões.

            // Distribuir comissões de mensalidade
            await distributeCommissions(user._id, 'monthly', product);

            res.status(200).json({
                message: 'Mensalidade paga com sucesso! Pagamento em processamento.',
                user,
                asaasPayment: asaasPaymentResponse // Retorna a resposta do Asaas para o frontend
            });
        } else {
            res.status(500).json({ message: 'Pagamento da mensalidade não foi processado com sucesso pelo Asaas.', asaasPayment: asaasPaymentResponse });
        }

    } catch (error) {
        console.error('Erro geral ao pagar mensalidade:', error.message);
        res.status(500).json({ message: 'Erro ao pagar mensalidade.', error: error.message });
    }
});


// 4. Área Financeira do Usuário
app.get('/users/:userId/finance', async (req, res) => {
    const { userId } = req.params;
    try {
        const user = await User.findById(userId).populate('commissions.fromUser', 'username');
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.status(200).json({
            balance: user.balance,
            commissionsHistory: user.commissions,
            // Adicionar histórico de saques futuramente
        });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar dados financeiros.', error: error.message });
    }
});

// Solicitação de Saque
app.post('/users/:userId/withdraw', async (req, res) => {
    const { userId } = req.params;
    const { amount } = req.body;

    try {
        const user = await User.findById(userId);
        const settings = await CompanySettings.findOne(); // Pega as configurações gerais

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const minAmount = settings ? settings.minWithdrawalAmount : 50; // Valor padrão de 50 se não houver configurações

        if (amount <= 0 || amount > user.balance || amount < minAmount) {
            return res.status(400).json({
                message: `Valor de saque inválido. Saldo disponível: R$${user.balance}. Valor mínimo: R$${minAmount}.`
            });
        }

        const newWithdrawal = new WithdrawalRequest({
            user: userId,
            amount: amount,
            status: 'pending',
        });
        await newWithdrawal.save();

        // O valor é deduzido do saldo apenas quando o saque é aprovado pelo admin
        // user.balance -= amount;
        // await user.save();

        res.status(201).json({ message: 'Solicitação de saque enviada com sucesso! Aguardando aprovação.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao solicitar saque.', error: error.message });
    }
});


// 5. Personalização da Marca (White Label) - Apenas Admin
app.get('/admin/settings', async (req, res) => {
    try {
        let settings = await CompanySettings.findOne();
        if (!settings) {
            // Se não houver configurações, cria uma com valores padrão
            settings = await CompanySettings.create({});
        }
        res.status(200).json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar configurações.', error: error.message });
    }
});

app.put('/admin/settings', async (req, res) => {
    const updates = req.body;
    try {
        // Encontra e atualiza (ou insere se não existir)
        const settings = await CompanySettings.findOneAndUpdate({}, updates, { new: true, upsert: true });
        res.status(200).json({ message: 'Configurações atualizadas com sucesso!', settings });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar configurações.', error: error.message });
    }
});

// 6. Comunicação com Usuários (Comunicados e Notificações Push Internas) - Apenas Admin
app.post('/admin/announcements', async (req, res) => {
    const { title, content } = req.body;
    try {
        const newAnnouncement = new Announcement({ title, content });
        await newAnnouncement.save();
        res.status(201).json({ message: 'Comunicado criado com sucesso!', announcement: newAnnouncement });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao criar comunicado.', error: error.message });
    }
});

app.get('/announcements', async (req, res) => {
    try {
        const announcements = await Announcement.find().sort({ date: -1 });
        res.status(200).json(announcements);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar comunicados.', error: error.message });
    }
});

// 7. Área de Material de Apoio - Apenas Admin pode adicionar
app.post('/admin/support-materials', async (req, res) => {
    const { title, description, fileUrl, fileType, category } = req.body;
    try {
        const newMaterial = new SupportMaterial({ title, description, fileUrl, fileType, category });
        await newMaterial.save();
        res.status(201).json({ message: 'Material de apoio adicionado com sucesso!', material: newMaterial });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao adicionar material de apoio.', error: error.message });
    }
});

app.get('/support-materials', async (req, res) => {
    try {
        const materials = await SupportMaterial.find().sort({ uploadDate: -1 });
        res.status(200).json(materials);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar materiais de apoio.', error: error.message });
    }
});

app.get('/support-materials/categories', async (req, res) => {
    try {
        const categories = await SupportMaterial.distinct('category');
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar categorias de materiais.', error: error.message });
    }
});

// No seu server.js, adicione esta rota:
app.get('/users/:userId/network', async (req, res) => {
    const { userId } = req.params;
    try {
        const user = await User.findById(userId).populate({
            path: 'network.level1 network.level2 network.level3 network.level4 network.level5 network.level6 network.level7 network.level8',
            select: 'username email isActive'
        });
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.status(200).json({ network: user.network });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar rede do usuário.', error: error.message });
    }
});


// 8. Painel Administrativo
// Gestão de Saques (Admin)
app.get('/admin/withdrawal-requests', async (req, res) => {
    try {
        const requests = await WithdrawalRequest.find().populate('user', 'username email balance');
        res.status(200).json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar solicitações de saque.', error: error.message });
    }
});

app.put('/admin/withdrawal-requests/:id/approve', async (req, res) => {
    const { id } = req.params;
    try {
        const withdrawal = await WithdrawalRequest.findById(id);
        if (!withdrawal) {
            return res.status(404).json({ message: 'Solicitação de saque não encontrada.' });
        }
        if (withdrawal.status !== 'pending') {
            return res.status(400).json({ message: 'Esta solicitação já foi processada.' });
        }

        const user = await User.findById(withdrawal.user);
        if (!user) {
            return res.status(404).json({ message: 'Usuário do saque não encontrado.' });
        }

        if (user.balance < withdrawal.amount) {
            return res.status(400).json({ message: 'Saldo insuficiente do usuário para aprovar o saque.' });
        }

        user.balance -= withdrawal.amount;
        withdrawal.status = 'approved';
        withdrawal.processDate = Date.now();

        await user.save();
        await withdrawal.save();

        res.status(200).json({ message: 'Saque aprovado com sucesso!', withdrawal });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao aprovar saque.', error: error.message });
    }
});

app.put('/admin/withdrawal-requests/:id/reject', async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
        const withdrawal = await WithdrawalRequest.findById(id);
        if (!withdrawal) {
            return res.status(404).json({ message: 'Solicitação de saque não encontrada.' });
        }
        if (withdrawal.status !== 'pending') {
            return res.status(400).json({ message: 'Esta solicitação já foi processada.' });
        }

        withdrawal.status = 'rejected';
        withdrawal.processDate = Date.now();
        withdrawal.rejectionReason = reason; // Adicione um campo de motivo de rejeição ao schema se necessário

        await withdrawal.save();

        res.status(200).json({ message: 'Saque rejeitado com sucesso!', withdrawal });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao rejeitar saque.', error: error.message });
    }
});

// Relatórios (Exemplos)
app.get('/admin/reports/network/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const user = await User.findById(userId).populate({
            path: 'network.level1 network.level2 network.level3 network.level4 network.level5 network.level6 network.level7 network.level8',
            select: 'username email isActive' // Seleciona apenas os campos necessários
        });
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.status(200).json({ network: user.network });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao gerar relatório de rede.', error: error.message });
    }
});

app.get('/admin/reports/financial', async (req, res) => {
    try {
        const totalBalance = await User.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]);
        const totalPendingWithdrawals = await WithdrawalRequest.aggregate([
            { $match: { status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalApprovedWithdrawals = await WithdrawalRequest.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        res.status(200).json({
            totalUserBalance: totalBalance[0] ? totalBalance[0].total : 0,
            totalPendingWithdrawals: totalPendingWithdrawals[0] ? totalPendingWithdrawals[0].total : 0,
            totalApprovedWithdrawals: totalApprovedWithdrawals[0] ? totalApprovedWithdrawals[0].total : 0,
        });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao gerar relatório financeiro.', error: error.message });
    }
});


// Rotas para Gerenciamento de Usuários (Admin)
app.get('/admin/users', async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Não retorna a senha
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar usuários.', error: error.message });
    }
});

app.get('/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User.findById(id).select('-password').populate('sponsor', 'username');
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar usuário.', error: error.message });
    }
});

app.put('/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    // Evite atualizar a senha ou campos sensíveis diretamente por aqui sem validação
    delete updates.password; // Garante que a senha não seja atualizada sem querer
    try {
        const updatedUser = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
        if (!updatedUser) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.status(200).json({ message: 'Usuário atualizado com sucesso!', user: updatedUser });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Nome de usuário ou e-mail já em uso.' });
        }
        res.status(500).json({ message: 'Erro ao atualizar usuário.', error: error.message });
    }
});

app.delete('/admin/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const deletedUser = await User.findByIdAndDelete(id);
        if (!deletedUser) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        // Lógica adicional para remover o usuário da rede de seus patrocinadores, etc.
        // Isso pode ser complexo dependendo da profundidade da remoção.
        res.status(200).json({ message: 'Usuário excluído com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao excluir usuário.', error: error.message });
    }
});


// Iniciar o Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
