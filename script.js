document.addEventListener('DOMContentLoaded', () => {
    const USER_DB_KEY = 'umaSkillChecker_userData_v9';
    let DB = {
        master: {},
        user: {}
    };

    let currentDeck = {
        scenario: null,
        inza: [null, null],
        supportCards: [null, null, null, null, null, null]
    };
    let skillCheckStates = {};

    // --- DOM 요소 캐싱 ---
    const themeToggle = document.getElementById('theme-toggle');
    const scenarioSelect = document.getElementById('scenario-select');
    const inzaSelects = document.querySelectorAll('.inza-select');
    const scSelects = document.querySelectorAll('.sc-select');
    const skillListContainer = document.getElementById('skill-list-container');
    const acquiredSkillsSection = document.getElementById('acquired-skills-section');
    const acquiredSkillsContainer = document.getElementById('acquired-skills-container');
    const resetSkillsBtn = document.getElementById('reset-skills');
    const downloadBtn = document.getElementById('download-button');
    const uploadBtn = document.getElementById('upload-button');
    const uploadInput = document.getElementById('upload-json');
    const resetDataBtn = document.getElementById('reset-data-button');
    const hideAcquiredToggle = document.getElementById('hide-acquired-toggle');
    const showDetailsToggle = document.getElementById('show-details-toggle');
    // Target Modal
    const openTargetModalBtn = document.getElementById('open-target-modal-btn');
    const targetProgressBar = document.getElementById('target-progress-bar');
    const targetProgressText = document.getElementById('target-progress-text');
    const acquiredTargetCount = document.getElementById('acquired-target-count');
    const remainingTargetCount = document.getElementById('remaining-target-count');
    const acquiredTargetBubbles = document.getElementById('acquired-target-bubbles');
    const remainingTargetBubbles = document.getElementById('remaining-target-bubbles');
    const targetModal = document.getElementById('target-modal');
    // Collection Modal
    const manageCollectionBtn = document.getElementById('manage-collection-btn');
    const collectionModal = document.getElementById('collection-modal');
    
    // --- 데이터 관리 ---
    function saveUserData() {
        try {
            const dataToSave = {
                ...DB.user,
                savedDeck: currentDeck,
                skillCheckStates: skillCheckStates
            };
            localStorage.setItem(USER_DB_KEY, JSON.stringify(dataToSave));
        } catch (error) {
            console.error("localStorage 저장 실패:", error);
            alert("데이터 저장에 실패했습니다. 브라우저의 저장 공간이 부족할 수 있습니다.");
        }
    }

    function loadUserData() {
        try {
            const savedData = localStorage.getItem(USER_DB_KEY);
            return savedData ? JSON.parse(savedData) : createDefaultUserData();
        } catch (error) {
            console.error("저장된 사용자 데이터 파싱 실패:", error);
            alert("저장된 사용자 데이터를 불러오는 데 실패했습니다. 데이터를 초기화합니다.");
            localStorage.removeItem(USER_DB_KEY);
            return createDefaultUserData();
        }
    }

    function createDefaultUserData() {
        return {
            userSettings: { theme: 'light', hideAcquired: false, showDetails: false },
            customData: { skills: [], supportCards: [], inzaCharacters: [] },
            myCollection: { supportCards: [], inzaCharacters: [] },
            targetSkills: { required: [], ignored: [] },
            savedDeck: { scenario: null, inza: [null, null], supportCards: [null, null, null, null, null, null] },
            skillCheckStates: {}
        };
    }

    async function loadMasterData() {
        try {
            const response = await fetch('masterData.json?v=0.9.0');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('마스터 데이터 로드 실패:', error);
            alert('필수 데이터 로드에 실패했습니다. 앱을 사용할 수 없습니다.');
            return null;
        }
    }

    function applyUserData(data) {
        if (!data) return;
        DB.user = data;
        
        // 데이터 구조 유효성 검사 및 기본값 할당 (방어적 코딩)
        DB.user.userSettings = DB.user.userSettings || { theme: 'light', hideAcquired: false, showDetails: false };
        DB.user.customData = DB.user.customData || { skills: [], supportCards: [], inzaCharacters: [] };
        DB.user.myCollection = DB.user.myCollection || { supportCards: [], inzaCharacters: [] };
        DB.user.targetSkills = DB.user.targetSkills || { required: [], ignored: [] };

        currentDeck = data.savedDeck || { scenario: null, inza: [null, null], supportCards: [null, null, null, null, null, null] };
        skillCheckStates = data.skillCheckStates || {};
        
        hideAcquiredToggle.checked = DB.user.userSettings.hideAcquired;
        showDetailsToggle.checked = DB.user.userSettings.showDetails;

        applyTheme(DB.user.userSettings.theme);
        applyDetailsVisibility(DB.user.userSettings.showDetails);
    }
    
    // --- 메인 렌더링 ---
    function renderAll() {
        populateSelectors();
        restoreDeckSelection();
        const obtainableSkills = getObtainableSkills();
        renderSkillList(obtainableSkills);
        updateTargetProgress(obtainableSkills);
    }

    // --- UI 렌더링 ---
    function populateSelectors() {
        const scenarioOptions = (DB.master.scenarios || []).map(s => `<option value="${s.scenarioId}">${s.name}</option>`).join('');
        scenarioSelect.innerHTML = '<option value="">-- 시나리오 --</option>' + scenarioOptions;
        
        const inzaOptions = (DB.user.myCollection.inzaCharacters || []).map(inza => `<option value="${inza.userInzaId}">${inza.name}</option>`).join('');
        inzaSelects.forEach(select => { select.innerHTML = '<option value="">-- 인자 선택 --</option>' + inzaOptions; });

        const scOptions = (DB.user.myCollection.supportCards || []).map(sc => `<option value="${sc.userCardId}">${sc.name} (Lv.${sc.level * 5 + 30})</option>`).join('');
        scSelects.forEach(select => { select.innerHTML = '<option value="">-- 선택 --</option>' + scOptions; });
    }
    
    function restoreDeckSelection() {
        if (currentDeck.scenario) scenarioSelect.value = currentDeck.scenario;
        inzaSelects.forEach((s, i) => { if (currentDeck.inza[i]) s.value = currentDeck.inza[i]; });
        scSelects.forEach((s, i) => { if (currentDeck.supportCards[i]) s.value = currentDeck.supportCards[i]; });
    }
    
    function getSkillData(skillId) {
        return DB.master.skills.find(s => s.skillId === skillId) || 
               (DB.user.customData.skills || []).find(s => s.skillId === skillId);
    }

    function renderSkillList(obtainableSkills) {
        const lists = { scenarioOnly: [], inzaOnly: [], supportOnly: [], common: [], acquired: [] };
        const hideAcquired = hideAcquiredToggle.checked;

        Object.values(obtainableSkills).forEach(skill => {
            if (skillCheckStates[skill.skillId] === 2) {
                lists.acquired.push(skill);
                if (!hideAcquired) distributeSkill(lists, skill);
            } else {
                distributeSkill(lists, skill);
            }
        });

        let html = '';
        if (Object.values(obtainableSkills).length === 0) {
            html = '<p class="placeholder">덱을 편성하면 획득 가능한 스킬 목록이 여기에 표시됩니다.</p>';
        } else {
            if (lists.scenarioOnly.length > 0) html += createGroupHtml('🌌 시나리오 스킬', lists.scenarioOnly);
            if (lists.inzaOnly.length > 0) html += createGroupHtml('🟪 인자로만 얻는 스킬', lists.inzaOnly);
            if (lists.supportOnly.length > 0) html += createGroupHtml('🟦 서포트로만 얻는 스킬', lists.supportOnly);
            if (lists.common.length > 0) html += createGroupHtml('🟩 공용 스킬', lists.common);
            if (!html && lists.acquired.length > 0 && hideAcquired) {
                 html = '<p class="placeholder">획득할 스킬이 없거나 모두 획득했습니다.</p>';
            }
        }
        
        skillListContainer.innerHTML = html;
        acquiredSkillsContainer.innerHTML = createSubGroupHtml(lists.acquired);
        acquiredSkillsSection.hidden = (lists.acquired.length === 0);
        acquiredSkillsSection.open = !hideAcquired && lists.acquired.length > 0;
    }
    
    function distributeSkill(lists, skill) {
        const types = new Set(skill.sources.map(s => {
            if (s.type === '인자' || s.type === '고유') return 'inza';
            if (s.type === '시나리오' || s.type === '금색-시나리오') return 'scenario';
            return 'support';
        }));
        if (types.size === 1) {
            if (types.has('inza')) lists.inzaOnly.push(skill);
            else if (types.has('scenario')) lists.scenarioOnly.push(skill);
            else lists.supportOnly.push(skill);
        } else {
            lists.common.push(skill);
        }
    }

    function createGroupHtml(title, skills) {
        const subGroups = { common: [], distance: [], style: [] };
        skills.forEach(skill => {
            const skillData = getSkillData(skill.skillId);
            const category = skillData?.category || 'common';
            if (!subGroups[category]) subGroups[category] = [];
            subGroups[category].push(skill);
        });

        let finalHtml = '';
        const categoryOrder = ['common', 'distance', 'style'];
        let hasPreviousContent = false;

        categoryOrder.forEach(category => {
            if (subGroups[category] && subGroups[category].length > 0) {
                if (hasPreviousContent) finalHtml += `<div class="sub-group-divider"></div>`;
                finalHtml += createSubGroupHtml(subGroups[category]);
                hasPreviousContent = true;
            }
        });

        if (!finalHtml) return '';
        return `<div class="skill-group"><h3>${title}</h3>${finalHtml}</div>`;
    }

    function createSubGroupHtml(skills) {
        const upgradeOrder = { 'gold': 1, 'evolved': 2, 'normal': 3 };
        const effectOrder = { 'passive': 1, 'heal': 2, 'debuff': 3, 'normal': 4 };

        skills.sort((a, b) => {
            const skillA_Data = getSkillData(a.skillId);
            const skillB_Data = getSkillData(b.skillId);
            if (!skillA_Data || !skillB_Data) return 0;

            if (skillA_Data.isUnique !== skillB_Data.isUnique) return skillA_Data.isUnique ? -1 : 1;
            
            const orderA = upgradeOrder[skillA_Data.upgradeType] || 99;
            const orderB = upgradeOrder[skillB_Data.upgradeType] || 99;
            if (orderA !== orderB) return orderA - orderB;

            const effectOrderA = effectOrder[skillA_Data.effectType] || 99;
            const effectOrderB = effectOrder[skillB_Data.effectType] || 99;
            if (effectOrderA !== effectOrderB) return effectOrderA - effectOrderB;

            return a.name.localeCompare(b.name);
        });
        
        let html = '';
        skills.forEach(skill => {
            const skillData = getSkillData(skill.skillId);
            if (!skillData) return;
            const state = skillCheckStates[skill.skillId] || 0;
            const isTarget = DB.user.targetSkills.required.includes(skill.skillId);
            const sources = skill.sources.map(s => `${s.name}(${s.type}${s.level || ''})`).join(', ');
            
            let classList = 'skill-item';
            if (skillData.isUnique) classList += ' skill-item--unique';
            else if (skillData.upgradeType) classList += ` skill-item--${skillData.upgradeType}`;
            if (skillData.isCustom) classList += ' skill-item--custom';
            if (skillData.effectType) classList += ` skill-item--effect-${skillData.effectType}`;
            if (isTarget) classList += ' skill-item--target';
            
            const tagsHtml = (skillData.tags || []).map(tag => `<span class="skill-tag">${tag}</span>`).join('');
            
            let detailsHtml = '';
            if (skillData.evolutionCondition) {
                detailsHtml = `<p><strong>진화 조건:</strong> ${skillData.evolutionCondition}</p>`;
            }

            html += `
                <div id="skill-item-${skill.skillId}" class="${classList}" data-skill-id="${skill.skillId}">
                    <div class="skill-item__main">
                        <div class="skill-info">
                            <div>
                                <span class="skill-name">${skillData.name}</span>
                                ${tagsHtml}
                            </div>
                            <div class="skill-source">${sources}</div>
                        </div>
                        <button class="skill-checkbox" data-state="${state}"></button>
                    </div>
                    ${detailsHtml ? `<div class="skill-details">${detailsHtml}</div>` : ''}
                </div>`;
        });
        return html;
    }
    
    // --- 핵심 로직 ---
    function getObtainableSkills() {
        const skills = {};
        const ignoredSkills = DB.user.targetSkills?.ignored || [];
        
        const addSkill = (skillId, sourceName, type, level = null) => {
            if (!skillId) return;
            if (!skills[skillId]) {
                const skillData = getSkillData(skillId);
                skills[skillId] = { skillId, name: skillData?.name || `알수없는 스킬(${skillId})`, sources: [] };
            }
            skills[skillId].sources.push({ name: sourceName, type, level });
        };
        
        currentDeck.inza.forEach(userInzaId => {
            if (!userInzaId) return;
            const inza = DB.user.myCollection.inzaCharacters.find(i => i.userInzaId === userInzaId);
            if (!inza) return;
            
            const masterInza = DB.master.inzaCharacters.find(i => i.masterInzaId === inza.masterInzaId) || 
                             (DB.user.customData.inzaCharacters || []).find(i => i.masterInzaId === inza.masterInzaId);
            if (!masterInza) return;

            Object.values(masterInza.slots).forEach(slot => {
                if (slot.uniqueSkillId) addSkill(slot.uniqueSkillId, slot.name, '고유');
                slot.skillFactors.forEach(skillId => addSkill(skillId, slot.name, '인자'));
            });
        });
        
        [...new Set(currentDeck.supportCards.filter(sc => sc))].forEach(userCardId => {
            const card = DB.user.myCollection.supportCards.find(c => c.userCardId === userCardId);
            if (!card) return;

            const masterCard = DB.master.supportCards.find(c => c.masterCardId === card.masterCardId) || 
                             (DB.user.customData.supportCards || []).find(c => c.masterCardId === card.masterCardId);
            if (!masterCard) return;

            (masterCard.goldenSkills || []).forEach(gs => gs.choices.forEach(skillId => addSkill(skillId, masterCard.name, '금색')));
            (masterCard.skills || []).forEach(skillId => addSkill(skillId, masterCard.name, '힌트'));
        });

        if(currentDeck.scenario) {
            const scenarioData = DB.master.scenarios.find(s => s.scenarioId === currentDeck.scenario);
            if(scenarioData) {
                (scenarioData.goldenSkills || []).forEach(gs => gs.choices.forEach(skillId => addSkill(skillId, scenarioData.name, '금색-시나리오')));
                (scenarioData.skills || []).forEach(s => addSkill(s.skillId, scenarioData.name, '시나리오', s.level));
            }
        }
        
        ignoredSkills.forEach(id => delete skills[id]);
        return skills;
    }

    // --- 목표 관리 ---
    function updateTargetProgress(obtainableSkills) {
        const { required = [] } = DB.user.targetSkills || {};
        if (required.length === 0) {
            targetProgressBar.style.width = '0%';
            targetProgressText.textContent = '목표를 설정해주세요.';
            acquiredTargetBubbles.innerHTML = ''; remainingTargetBubbles.innerHTML = '';
            acquiredTargetCount.textContent = 0; remainingTargetCount.textContent = 0;
            return;
        }

        let acquiredCount = 0;
        let acquiredBubblesHTML = '';
        let remainingBubblesHTML = '';
        
        required.forEach(skillId => {
            const skill = getSkillData(skillId);
            if (!skill) return;

            const isObtainable = !!obtainableSkills[skillId];
            const isAcquired = skillCheckStates[skillId] === 2;
            const bubbleClass = isAcquired ? 'acquired' : 'remaining';
            const bubbleHTML = `<div class="target-bubble ${bubbleClass}" data-skill-id="${skillId}" title="${isObtainable ? '획득 가능' : '획득 불가능'}">${skill.name} ${!isObtainable ? '⚠️' : ''}</div>`;
            
            if (isAcquired) {
                acquiredCount++;
                acquiredBubblesHTML += bubbleHTML;
            } else {
                remainingBubblesHTML += bubbleHTML;
            }
        });

        targetProgressBar.style.width = `${(acquiredCount / required.length) * 100}%`;
        targetProgressText.textContent = `달성: ${acquiredCount} / ${required.length}`;
        acquiredTargetCount.textContent = acquiredCount;
        remainingTargetCount.textContent = required.length - acquiredCount;
        acquiredTargetBubbles.innerHTML = acquiredBubblesHTML;
        remainingTargetBubbles.innerHTML = remainingBubblesHTML;
    }

    // --- 모달 관리 (기존 목표 모달은 생략, 컬렉션 모달 위주) ---
    function setupModal(modalId, openBtnId) {
        const modal = document.getElementById(modalId);
        const openBtn = document.getElementById(openBtnId);
        const closeBtn = modal.querySelector('.modal-close-btn');

        openBtn.addEventListener('click', () => modal.style.display = 'flex');
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    function setupCollectionModal() {
        const modal = document.getElementById('collection-modal');
        const openBtn = document.getElementById('manage-collection-btn');
        const closeBtn = modal.querySelector('.modal-close-btn');
        const tabs = modal.querySelectorAll('.tab-btn');
        const tabContents = modal.querySelectorAll('.tab-content');

        openBtn.addEventListener('click', () => {
            renderCollectionModal();
            modal.style.display = 'flex';
        });
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                tabContents.forEach(c => c.classList.remove('active'));
                document.getElementById(tab.dataset.tab).classList.add('active');
            });
        });

        // 폼 제출 이벤트
        document.getElementById('add-master-sc-form').addEventListener('submit', handleAddMasterSC);
        document.getElementById('add-custom-sc-form').addEventListener('submit', handleAddCustomSC);
        document.getElementById('add-custom-inza-form').addEventListener('submit', handleAddCustomInza);

        // 검색 및 목록 클릭 이벤트
        document.getElementById('master-inza-search').addEventListener('input', handleInzaSearch);
        document.getElementById('sc-collection-list').addEventListener('click', handleCollectionItemAction);
        document.getElementById('inza-collection-list').addEventListener('click', handleCollectionItemAction);
    }
    
    function renderCollectionModal() {
        // Master SC 드롭다운 채우기
        const masterScSelect = document.getElementById('master-sc-select');
        masterScSelect.innerHTML = '<option value="">-- 마스터 카드 선택 --</option>' 
            + DB.master.supportCards.map(sc => `<option value="${sc.masterCardId}">${sc.name}</option>`).join('');
        
        // 내 컬렉션 목록 렌더링
        renderSupportCardCollection();
        renderInzaCollection();
    }
    
    function renderSupportCardCollection() {
        const listEl = document.getElementById('sc-collection-list');
        listEl.innerHTML = (DB.user.myCollection.supportCards || []).map(card => `
            <div class="collection-item" data-id="${card.userCardId}" data-type="sc">
                <div class="collection-item-info">
                    <span class="name">${card.name}</span>
                    <div class="details">고유ID: ${card.userCardId}</div>
                </div>
                <div class="collection-item-actions">
                    <div class="level-editor">
                        <label>돌파:</label>
                        <input type="number" class="level-input" value="${card.level}" min="0" max="4">
                    </div>
                    <button class="delete-btn">삭제</button>
                </div>
            </div>
        `).join('');
    }

    function renderInzaCollection() {
        const listEl = document.getElementById('inza-collection-list');
        listEl.innerHTML = (DB.user.myCollection.inzaCharacters || []).map(inza => `
            <div class="collection-item" data-id="${inza.userInzaId}" data-type="inza">
                <div class="collection-item-info">
                    <span class="name">${inza.name}</span>
                    <div class="details">고유ID: ${inza.userInzaId}</div>
                </div>
                <div class="collection-item-actions">
                    <button class="delete-btn">삭제</button>
                </div>
            </div>
        `).join('');
    }
    
    function handleAddMasterSC(e) {
        e.preventDefault();
        const masterCardId = document.getElementById('master-sc-select').value;
        const level = parseInt(document.getElementById('master-sc-level').value, 10);
        if (!masterCardId) {
            alert('마스터 카드를 선택해주세요.');
            return;
        }
        
        const masterCard = DB.master.supportCards.find(c => c.masterCardId === masterCardId);
        const newCard = {
            userCardId: `user_sc_${Date.now()}`,
            masterCardId: masterCard.masterCardId,
            name: masterCard.name,
            level: level,
        };

        DB.user.myCollection.supportCards.push(newCard);
        saveUserData();
        renderSupportCardCollection();
        populateSelectors();
        e.target.reset();
    }
    
    function getOrCreateSkillId(skillName) {
        const trimmedName = skillName.trim();
        if (!trimmedName) return null;

        let namePart = trimmedName;
        let effectType = 'normal';
        let tags = [];

        if (trimmedName.includes('#')) {
            const parts = trimmedName.split('#').map(p => p.trim());
            namePart = parts[0];
            effectType = parts[1] || 'normal';
            tags = parts.slice(2);
        }

        const existingSkill = DB.master.skills.find(s => s.name === namePart) ||
                              DB.user.customData.skills.find(s => s.name === namePart);
        if (existingSkill) return existingSkill.skillId;
        
        const newSkillId = `custom_s_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newSkill = {
            skillId: newSkillId,
            name: namePart,
            category: "common",
            effectType: effectType,
            tags: tags,
            isCustom: true,
        };
        DB.user.customData.skills.push(newSkill);
        console.log(`신규 커스텀 스킬 생성: ${namePart} (ID: ${newSkillId})`);
        return newSkillId;
    }

    function handleAddCustomSC(e) {
        e.preventDefault();
        const name = document.getElementById('custom-sc-name').value;
        const skillsText = document.getElementById('custom-sc-skills').value;
        if (!name) {
            alert('카드 이름을 입력해주세요.');
            return;
        }

        const skillIds = skillsText.split('\n')
            .map(line => getOrCreateSkillId(line))
            .filter(id => id !== null);
        
        const masterCardId = `custom_sc_${Date.now()}`;
        const newMasterCard = {
            masterCardId: masterCardId,
            name: name,
            skills: skillIds,
            isCustom: true,
        };
        DB.user.customData.supportCards.push(newMasterCard);

        const newCard = {
            userCardId: `user_sc_${Date.now()}`,
            masterCardId: masterCardId,
            name: name,
            level: 4, // 기본 풀돌
        };
        DB.user.myCollection.supportCards.push(newCard);
        
        saveUserData();
        renderSupportCardCollection();
        populateSelectors();
        e.target.reset();
    }
    
    function handleInzaSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        const resultsEl = document.getElementById('master-inza-search-results');
        if (!searchTerm) {
            resultsEl.innerHTML = '';
            return;
        }
        
        const results = DB.master.inzaCharacters.filter(inza => inza.name.toLowerCase().includes(searchTerm));
        resultsEl.innerHTML = results.map(inza => 
            `<div class="result-item" data-id="${inza.masterInzaId}">${inza.name}</div>`
        ).join('');

        // 검색 결과 클릭 이벤트 (이벤트 위임)
        if (!resultsEl.hasAttribute('data-listener-added')) {
            resultsEl.addEventListener('click', e => {
                if (e.target.classList.contains('result-item')) {
                    const masterInzaId = e.target.dataset.id;
                    const masterInza = DB.master.inzaCharacters.find(i => i.masterInzaId === masterInzaId);
                    if (masterInza && confirm(`'${masterInza.name}' 인자를 컬렉션에 추가하시겠습니까?`)) {
                        const newInza = {
                            userInzaId: `user_inza_${Date.now()}`,
                            masterInzaId: masterInza.masterInzaId,
                            name: masterInza.name,
                        };
                        DB.user.myCollection.inzaCharacters.push(newInza);
                        saveUserData();
                        renderInzaCollection();
                        populateSelectors();
                        document.getElementById('master-inza-search').value = '';
                        resultsEl.innerHTML = '';
                    }
                }
            });
            resultsEl.setAttribute('data-listener-added', 'true');
        }
    }
    
    function handleAddCustomInza(e) {
        e.preventDefault();
        const name = document.getElementById('custom-inza-name').value;
        const skillsText = document.getElementById('custom-inza-skills').value;
        if (!name) {
            alert('인자 이름을 입력해주세요.');
            return;
        }

        const skillIds = skillsText.split('\n')
            .map(line => getOrCreateSkillId(line))
            .filter(id => id !== null);

        const masterInzaId = `custom_inza_${Date.now()}`;
        // 커스텀 인자는 간단하게 부모 슬롯에만 모든 스킬을 넣는 방식으로 처리
        const newMasterInza = {
            masterInzaId: masterInzaId,
            name: name,
            slots: { parent: { name: "커스텀", skillFactors: skillIds } },
            isCustom: true,
        };
        DB.user.customData.inzaCharacters.push(newMasterInza);

        const newInza = {
            userInzaId: `user_inza_${Date.now()}`,
            masterInzaId: masterInzaId,
            name: name,
        };
        DB.user.myCollection.inzaCharacters.push(newInza);
        
        saveUserData();
        renderInzaCollection();
        populateSelectors();
        e.target.reset();
    }
    
    function handleCollectionItemAction(e) {
        const target = e.target;
        const itemEl = target.closest('.collection-item');
        if (!itemEl) return;
        
        const id = itemEl.dataset.id;
        const type = itemEl.dataset.type;

        if (target.classList.contains('delete-btn')) {
            if (confirm('정말로 이 항목을 컬렉션에서 삭제하시겠습니까?')) {
                if (type === 'sc') {
                    DB.user.myCollection.supportCards = DB.user.myCollection.supportCards.filter(c => c.userCardId !== id);
                    renderSupportCardCollection();
                } else if (type === 'inza') {
                    DB.user.myCollection.inzaCharacters = DB.user.myCollection.inzaCharacters.filter(i => i.userInzaId !== id);
                    renderInzaCollection();
                }
                saveUserData();
                populateSelectors();
            }
        } else if (target.classList.contains('level-input')) {
             // blur 이벤트를 사용하여 입력이 끝났을 때 저장
            target.addEventListener('blur', () => {
                const newLevel = parseInt(target.value, 10);
                if (type === 'sc') {
                    const card = DB.user.myCollection.supportCards.find(c => c.userCardId === id);
                    if (card && card.level !== newLevel) {
                        card.level = newLevel;
                        saveUserData();
                        populateSelectors(); // 레벨이 이름에 표시되므로 업데이트
                    }
                }
            }, { once: true }); // 이벤트 리스너가 한 번만 실행되도록 설정
        }
    }


    // --- 이벤트 핸들러 ---
    function handleDeckChange() {
        currentDeck.scenario = scenarioSelect.value || null;
        inzaSelects.forEach((s, i) => currentDeck.inza[i] = s.value || null);
        scSelects.forEach((s, i) => currentDeck.supportCards[i] = s.value || null);
        renderAll();
        saveUserData();
    }
    
    function handleCheckboxClick(e) {
        if (!e.target.classList.contains('skill-checkbox')) return;
        const skillId = e.target.closest('.skill-item').dataset.skillId;
        const currentState = parseInt(e.target.dataset.state, 10);
        skillCheckStates[skillId] = (currentState + 1) % 3;
        renderAll();
        saveUserData();
    }
    
    function handleResetClick() {
        if (confirm('모든 스킬 체크 상태를 초기화하시겠습니까?')) {
            skillCheckStates = {};
            renderAll();
            saveUserData();
        }
    }
    
    function handleResetDataClick() {
        if (confirm('⚠️ 경고! 저장된 덱, 컬렉션, 목표 등 모든 사용자 데이터가 초기화됩니다. 계속하시겠습니까?')) {
            localStorage.removeItem(USER_DB_KEY);
            window.location.reload();
        }
    }
    
    function handleUploadChange(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonData = JSON.parse(e.target.result);
                // JSON 데이터 유효성 검사 (간단하게)
                if (jsonData.myCollection && jsonData.userSettings) {
                    applyUserData(jsonData);
                    saveUserData(); // 불러온 데이터를 즉시 저장
                    renderAll();
                    alert('데이터를 성공적으로 불러왔습니다.');
                } else {
                    throw new Error('유효하지 않은 데이터 파일 형식입니다.');
                }
            } catch (err) {
                console.error("파일 업로드 처리 오류:", err);
                alert(`오류: ${err.message}`);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    function toggleTheme() {
        const newTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        DB.user.userSettings.theme = newTheme;
        saveUserData();
    }

    function applyTheme(theme) {
        document.documentElement.dataset.theme = theme;
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    function applyDetailsVisibility(visible) {
        skillListContainer.classList.toggle('details-visible', visible);
    }

    // --- 초기화 및 이벤트 리스너 설정 ---
    async function initialize() {
        DB.master = await loadMasterData();
        if (!DB.master) return; // 마스터 데이터 로드 실패 시 앱 실행 중지

        const userData = loadUserData();
        applyUserData(userData);
        
        renderAll();

        // 메인 화면 이벤트 리스너
        themeToggle.addEventListener('click', toggleTheme);
        scenarioSelect.addEventListener('change', handleDeckChange);
        inzaSelects.forEach(s => s.addEventListener('change', handleDeckChange));
        scSelects.forEach(s => s.addEventListener('change', handleDeckChange));
        resetSkillsBtn.addEventListener('click', handleResetClick);
        hideAcquiredToggle.addEventListener('change', (e) => { DB.user.userSettings.hideAcquired = e.target.checked; renderAll(); saveUserData(); });
        showDetailsToggle.addEventListener('change', (e) => { DB.user.userSettings.showDetails = e.target.checked; applyDetailsVisibility(e.target.checked); saveUserData(); });
        downloadBtn.addEventListener('click', () => { const dataStr = JSON.stringify(DB.user, null, 2); const blob = new Blob([dataStr], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'uma-skill-userdata.json'; a.click(); URL.revokeObjectURL(url); });
        uploadBtn.addEventListener('click', () => uploadInput.click());
        uploadInput.addEventListener('change', handleUploadChange);
        resetDataBtn.addEventListener('click', handleResetDataClick);
        skillListContainer.addEventListener('click', handleCheckboxClick);
        acquiredSkillsContainer.addEventListener('click', handleCheckboxClick);
        
        // 모달 관련 이벤트 리스너
        setupModal('target-modal', 'open-target-modal-btn');
        setupCollectionModal();

        // (기존 목표 모달 관련 이벤트 리스너는 생략)
    }

    initialize();
});