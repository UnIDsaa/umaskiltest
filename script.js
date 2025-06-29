document.addEventListener('DOMContentLoaded', () => {
    const USER_DB_KEY = 'umaSkillChecker_userData_v10';
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
    const openTargetModalBtn = document.getElementById('open-target-modal-btn');
    const targetModal = document.getElementById('target-modal');
    const manageCollectionBtn = document.getElementById('manage-collection-btn');
    const collectionModal = document.getElementById('collection-modal');
    const collectionViewContainer = document.getElementById('collection-view-container');

    // --- 데이터 관리 ---
    function saveUserData() {
        try {
            DB.user.savedDeck = currentDeck;
            DB.user.skillCheckStates = skillCheckStates;
            localStorage.setItem(USER_DB_KEY, JSON.stringify(DB.user));
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
            if (confirm("저장된 사용자 데이터를 불러오는 데 실패했습니다. 데이터를 초기화하시겠습니까?")) {
                localStorage.removeItem(USER_DB_KEY);
                return createDefaultUserData();
            }
            throw error; // 사용자가 취소하면 에러 던져서 앱 실행 중단
        }
    }

    function createDefaultUserData() {
        return {
            version: "1.0.0",
            userSettings: { theme: 'light', hideAcquired: false, showDetails: false, lastCollectionTab: 'sc' },
            customData: { skills: [], supportCards: [], inzaCharacters: [] },
            myCollection: { supportCards: [], inzaCharacters: [] },
            targetSkills: { required: [], ignored: [] },
            savedDeck: { scenario: null, inza: [null, null], supportCards: [null, null, null, null, null, null] },
            skillCheckStates: {}
        };
    }

    async function loadMasterData() {
        try {
            const response = await fetch('masterData.json?v=1.0.0');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('마스터 데이터 로드 실패:', error);
            alert('필수 데이터 로드에 실패했습니다. 앱을 사용할 수 없습니다.');
            return null;
        }
    }

    function applyUserData(data) {
        // 데이터 구조 유효성 검사 및 기본값 할당 (방어적 코딩)
        DB.user = data || {};
        DB.user.userSettings = data.userSettings || { theme: 'light', hideAcquired: false, showDetails: false, lastCollectionTab: 'sc' };
        DB.user.customData = data.customData || { skills: [], supportCards: [], inzaCharacters: [] };
        DB.user.myCollection = data.myCollection || { supportCards: [], inzaCharacters: [] };
        DB.user.targetSkills = data.targetSkills || { required: [], ignored: [] };

        currentDeck = data.savedDeck || { scenario: null, inza: [null, null], supportCards: [null, null, null, null, null, null] };
        skillCheckStates = data.skillCheckStates || {};
        
        hideAcquiredToggle.checked = DB.user.userSettings.hideAcquired;
        showDetailsToggle.checked = DB.user.userSettings.showDetails;

        applyTheme(DB.user.userSettings.theme);
    }
    
    // --- 메인 렌더링 ---
    function renderAll() {
        populateSelectors();
        restoreDeckSelection();
        const obtainableSkills = getObtainableSkills();
        renderSkillList(obtainableSkills);
        updateTargetProgress(obtainableSkills);
    }

    // --- UI 렌더링 (메인 화면) ---
    function populateSelectors() {
        const selectedScIds = currentDeck.supportCards.filter(id => id);
        const selectedInzaIds = currentDeck.inza.filter(id => id);

        const scenarioOptions = (DB.master.scenarios || []).map(s => `<option value="${s.scenarioId}">${s.name}</option>`).join('');
        scenarioSelect.innerHTML = '<option value="">-- 시나리오 --</option>' + scenarioOptions;

        const inzaOptions = (DB.user.myCollection.inzaCharacters || []).map(inza => {
            const isDisabled = selectedInzaIds.includes(inza.userInzaId);
            return `<option value="${inza.userInzaId}">${inza.name}</option>`;
        }).join('');
        inzaSelects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">-- 인자 선택 --</option>' + inzaOptions;
            Array.from(select.options).forEach(opt => {
                if(selectedInzaIds.includes(opt.value) && opt.value !== currentValue) {
                    opt.disabled = true;
                }
            });
            select.value = currentValue;
        });

        const scOptions = (DB.user.myCollection.supportCards || []).map(sc => {
            const isDisabled = selectedScIds.includes(sc.userCardId);
            const levelInfo = getCardLevelInfo(sc);
            return `<option value="${sc.userCardId}">${sc.name} (${levelInfo.text})</option>`;
        }).join('');
        scSelects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">-- 선택 --</option>' + scOptions;
            Array.from(select.options).forEach(opt => {
                if(selectedScIds.includes(opt.value) && opt.value !== currentValue) {
                    opt.disabled = true;
                }
            });
            select.value = currentValue;
        });
    }
    
    function getCardLevelInfo(userCard) {
        if (!userCard) return { text: '', hintLevel: 0 };
        const masterCard = DB.master.supportCards.find(c => c.masterCardId === userCard.masterCardId) || 
                         (DB.user.customData.supportCards || []).find(c => c.masterCardId === userCard.masterCardId);
        
        let hintLevel = userCard.hintLevel || 0; // 커스텀 카드의 경우
        if (masterCard?.levelMapping) {
            hintLevel = masterCard.levelMapping[userCard.level] || 1;
        }

        let text = `돌파 ${userCard.level}`;
        if (userCard.level === 4) text += ' (풀돌)';
        if (userCard.level === 0) text += ' (명함)';
        text += `, 힌트Lv.${hintLevel}`;

        return { text, hintLevel };
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
    
    // (이하 skill list 및 target progress 렌더링 함수는 이전 답변과 동일. 생략하지 않고 모두 포함)
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
        if (Object.keys(obtainableSkills).length === 0) {
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
        
        skillListContainer.innerHTML = html || '<p class="placeholder">획득할 스킬이 없거나 모두 획득했습니다.</p>';
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
            return a.name.localeCompare(b.name, 'ko');
        });
        
        return skills.map(skill => {
            const skillData = getSkillData(skill.skillId);
            if (!skillData) return '';
            const state = skillCheckStates[skill.skillId] || 0;
            const isTarget = DB.user.targetSkills.required.includes(skill.skillId);
            const sources = skill.sources.map(s => `${s.name}(${s.type}${s.level ? ` Lv.${s.level}`: ''})`).join(', ');
            
            let classList = 'skill-item';
            if (skillData.isUnique) classList += ' skill-item--unique';
            else if (skillData.upgradeType) classList += ` skill-item--${skillData.upgradeType}`;
            if (skillData.isCustom) classList += ' skill-item--custom';
            if (skillData.effectType) classList += ` skill-item--effect-${skillData.effectType}`;
            if (isTarget) classList += ' skill-item--target';
            
            const tagsHtml = (skillData.tags || []).map(tag => `<span class="skill-tag">${tag}</span>`).join('');
            const detailsHtml = skillData.evolutionCondition ? `<p><strong>진화 조건:</strong> ${skillData.evolutionCondition}</p>` : '';

            return `
                <div id="skill-item-${skill.skillId}" class="${classList}" data-skill-id="${skill.skillId}">
                    <div class="skill-item__main">
                        <div class="skill-info">
                            <div><span class="skill-name">${skillData.name}</span>${tagsHtml}</div>
                            <div class="skill-source">${sources}</div>
                        </div>
                        <button class="skill-checkbox" data-state="${state}"></button>
                    </div>
                    ${detailsHtml ? `<div class="skill-details">${detailsHtml}</div>` : ''}
                </div>`;
        }).join('');
    }

    function updateTargetProgress(obtainableSkills) {
        const { required = [] } = DB.user.targetSkills || {};
        const progressBar = document.getElementById('target-progress-bar');
        const progressText = document.getElementById('target-progress-text');
        const acquiredCountEl = document.getElementById('acquired-target-count');
        const remainingCountEl = document.getElementById('remaining-target-count');
        const acquiredBubblesEl = document.getElementById('acquired-target-bubbles');
        const remainingBubblesEl = document.getElementById('remaining-target-bubbles');

        if (required.length === 0) {
            progressBar.style.width = '0%';
            progressText.textContent = '목표를 설정해주세요.';
            acquiredBubblesEl.innerHTML = ''; remainingBubblesEl.innerHTML = '';
            acquiredCountEl.textContent = 0; remainingCountEl.textContent = 0;
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

        progressBar.style.width = `${(acquiredCount / required.length) * 100}%`;
        progressText.textContent = `달성: ${acquiredCount} / ${required.length}`;
        acquiredCountEl.textContent = acquiredCount;
        remainingCountEl.textContent = required.length - acquiredCount;
        acquiredBubblesEl.innerHTML = acquiredBubblesHTML;
        remainingBubblesEl.innerHTML = remainingBubblesHTML;
    }
    
    // --- 핵심 로직 (획득 가능 스킬 계산) ---
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
            const userInza = DB.user.myCollection.inzaCharacters.find(i => i.userInzaId === userInzaId);
            if (!userInza) return;
            
            const masterInza = DB.master.inzaCharacters.find(i => i.masterInzaId === userInza.masterInzaId) || 
                             (DB.user.customData.inzaCharacters || []).find(i => i.masterInzaId === userInza.masterInzaId);
            if (!masterInza) return;

            Object.values(masterInza.slots || {}).forEach(slot => {
                if (slot.uniqueSkillId) addSkill(slot.uniqueSkillId, slot.name, '고유');
                (slot.skillFactors || []).forEach(skillId => addSkill(skillId, slot.name, '인자'));
            });
        });
        
        [...new Set(currentDeck.supportCards.filter(sc => sc))].forEach(userCardId => {
            const userCard = DB.user.myCollection.supportCards.find(c => c.userCardId === userCardId);
            if (!userCard) return;

            const masterCard = DB.master.supportCards.find(c => c.masterCardId === userCard.masterCardId) || 
                             (DB.user.customData.supportCards || []).find(c => c.masterCardId === userCard.masterCardId);
            if (!masterCard) return;
            
            const levelInfo = getCardLevelInfo(userCard);

            (masterCard.goldenSkills || []).forEach(gs => gs.choices.forEach(skillId => addSkill(skillId, masterCard.name, '금색')));
            (masterCard.hintSkills || []).forEach(skillId => addSkill(skillId, masterCard.name, '힌트', levelInfo.hintLevel));
            (masterCard.eventSkills || []).forEach(skillId => addSkill(skillId, masterCard.name, '이벤트'));
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

    // --- 컬렉션 모달 뷰 템플릿 ---
    function getCollectionMainViewHTML(activeTab) {
        DB.user.userSettings.lastCollectionTab = activeTab;
        saveUserData();

        const scList = (DB.user.myCollection.supportCards || []).map(card => {
            const levelInfo = getCardLevelInfo(card);
            return `
            <div class="collection-item" data-id="${card.userCardId}" data-type="sc">
                <div class="collection-item-info">
                    <span class="name">${card.name}</span>
                    <div class="details">${levelInfo.text}</div>
                </div>
                <div class="collection-item-actions"><button class="delete-btn">삭제</button></div>
            </div>`;
        }).join('') || '<p>보유한 서포트 카드가 없습니다.</p>';

        const inzaList = (DB.user.myCollection.inzaCharacters || []).map(inza => `
            <div class="collection-item" data-id="${inza.userInzaId}" data-type="inza">
                <div class="collection-item-info"><span class="name">${inza.name}</span></div>
                <div class="collection-item-actions"><button class="delete-btn">삭제</button></div>
            </div>`).join('') || '<p>보유한 인자가 없습니다.</p>';

        return `
            <div class="collection-header">
                <h2>내 컬렉션 관리</h2>
                <div class="collection-tabs">
                    <button class="tab-btn ${activeTab === 'sc' ? 'active' : ''}" data-tab="sc">서포트 카드</button>
                    <button class="tab-btn ${activeTab === 'inza' ? 'active' : ''}" data-tab="inza">인자</button>
                </div>
            </div>
            <div class="collection-main">
                <div class="collection-actions">
                    <button class="action-btn" data-action="addMaster">✚ 기존 ${activeTab === 'sc' ? '카드' : '인자'}에서 추가</button>
                    <button class="action-btn" data-action="addCustom">✚ 직접 생성</button>
                </div>
                <div class="collection-list">${activeTab === 'sc' ? scList : inzaList}</div>
            </div>`;
    }

    function getAddMasterScViewHTML() {
        const masterOptions = DB.master.supportCards.map(c => `<option value="${c.masterCardId}">${c.name}</option>`).join('');
        const levelOptions = [
            {val: 4, text: "4돌파 (풀돌)"}, {val: 3, text: "3돌파"}, {val: 2, text: "2돌파"}, {val: 1, text: "1돌파"}, {val: 0, text: "0돌파 (명함)"}
        ].map(o => `<option value="${o.val}">${o.text}</option>`).join('');
        
        return `
            <form class="collection-form-view">
                <h3>기존 서포트 카드 추가</h3>
                <div class="form-grid">
                    <div class="form-field">
                        <label for="master-sc-select">카드 선택</label>
                        <select id="master-sc-select" required>${masterOptions}</select>
                    </div>
                    <div class="form-field">
                        <label for="master-sc-level">돌파 레벨</label>
                        <select id="master-sc-level" required>${levelOptions}</select>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="cancel-btn" data-action="cancel">취소</button>
                    <button type="submit" class="save-btn">컬렉션에 추가</button>
                </div>
            </form>`;
    }

    function getAddCustomScViewHTML() {
        const hintOptions = [5,4,3,2,1].map(o => `<option value="${o}">${o}레벨</option>`).join('');
        return `
            <form class="collection-form-view">
                <h3>커스텀 서포트 카드 생성</h3>
                <div class="form-grid">
                    <div class="form-field">
                        <label for="custom-sc-name">카드 이름</label>
                        <input type="text" id="custom-sc-name" required placeholder="예: 나의 최강 엘콘">
                    </div>
                    <div class="form-field">
                        <label for="custom-sc-hint-level">힌트 레벨</label>
                        <select id="custom-sc-hint-level">${hintOptions}</select>
                    </div>
                    <div class="form-field">
                        <label for="custom-sc-hint-skills">힌트 스킬 목록 (한 줄에 하나)</label>
                        <textarea id="custom-sc-hint-skills" rows="4" placeholder="예: 코너회복"></textarea>
                    </div>
                    <div class="form-field">
                        <label for="custom-sc-event-skills">이벤트 획득 스킬 목록 (한 줄에 하나)</label>
                        <textarea id="custom-sc-event-skills" rows="4" placeholder="예: 물고 늘어지기"></textarea>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="cancel-btn" data-action="cancel">취소</button>
                    <button type="submit" class="save-btn">커스텀 카드 추가</button>
                </div>
            </form>`;
    }
    
    function getAddCustomInzaViewHTML() {
        const factorTypes = {
            blue: ['스피드', '스태미나', '파워', '근성', '지능'],
            red: ['더트', '단거리', '마일', '중거리', '장거리', '도주', '선행', '선입', '추입'],
            star: [3, 2, 1]
        };
        const slots = ['parent', 'grandparent1', 'grandparent2'];
        const slotNames = {'parent': '부모', 'grandparent1': '조부모 1', 'grandparent2': '조부모 2'};

        const slotForms = slots.map(slotId => `
            <div class="inza-slot-form">
                <h4>${slotNames[slotId]} 슬롯</h4>
                <div class="form-grid">
                    <div class="form-field">
                        <label for="inza-char-name-${slotId}">캐릭터 이름</label>
                        <input type="text" id="inza-char-name-${slotId}" placeholder="예: 키타산 블랙">
                    </div>
                    <div class="factor-grid">
                        <div class="form-field">
                            <label>청인자</label>
                            <select id="inza-blue-type-${slotId}"><option value="">-타입-</option>${factorTypes.blue.map(t=>`<option value="${t}">${t}</option>`).join('')}</select>
                            <select id="inza-blue-star-${slotId}"><option value="">-★-</option>${factorTypes.star.map(s=>`<option value="${s}">${s}</option>`).join('')}</select>
                        </div>
                        <div class="form-field">
                            <label>적인자</label>
                            <select id="inza-red-type-${slotId}"><option value="">-타입-</option>${factorTypes.red.map(t=>`<option value="${t}">${t}</option>`).join('')}</select>
                            <select id="inza-red-star-${slotId}"><option value="">-★-</option>${factorTypes.star.map(s=>`<option value="${s}">${s}</option>`).join('')}</select>
                        </div>
                        <div class="form-field">
                            <label>녹인자 (선택)</label>
                            <input type="text" id="inza-green-skill-${slotId}" placeholder="스킬명">
                            <select id="inza-green-star-${slotId}"><option value="">-★-</option>${factorTypes.star.map(s=>`<option value="${s}">${s}</option>`).join('')}</select>
                        </div>
                    </div>
                    <div class="form-field">
                        <label for="inza-skills-${slotId}">스킬 인자 목록 (한 줄에 하나)</label>
                        <textarea id="inza-skills-${slotId}" rows="3" placeholder="예: 코너달인"></textarea>
                    </div>
                </div>
            </div>
        `).join('');

        return `
             <form class="collection-form-view">
                <h3>커스텀 인자 세트 생성</h3>
                 <div class="form-field">
                    <label for="custom-inza-set-name">인자 세트 이름</label>
                    <input type="text" id="custom-inza-set-name" required placeholder="예: 나의 결전용 보드카 인자">
                </div>
                ${slotForms}
                <div class="form-actions">
                    <button type="button" class="cancel-btn" data-action="cancel">취소</button>
                    <button type="submit" class="save-btn">인자 세트 추가</button>
                </div>
            </form>
        `;
    }

    // --- 컬렉션 관리 로직 ---
    function renderCollectionView(viewName, params = {}) {
        let html = '';
        switch(viewName) {
            case 'main': html = getCollectionMainViewHTML(params.activeTab || 'sc'); break;
            case 'addMasterSc': html = getAddMasterScViewHTML(); break;
            case 'addCustomSc': html = getAddCustomScViewHTML(); break;
            case 'addCustomInza': html = getAddCustomInzaViewHTML(); break;
        }
        collectionViewContainer.innerHTML = html;
        addCollectionEventListeners(viewName);
    }
    
    function addCollectionEventListeners(viewName) {
        const container = collectionViewContainer;
        if (viewName === 'main') {
            container.querySelector('.collection-tabs')?.addEventListener('click', e => {
                if (e.target.matches('.tab-btn')) renderCollectionView('main', { activeTab: e.target.dataset.tab });
            });
            container.querySelector('.collection-actions')?.addEventListener('click', e => {
                if (e.target.matches('[data-action="addMaster"]')) {
                    const activeTab = DB.user.userSettings.lastCollectionTab;
                    if(activeTab === 'sc') renderCollectionView('addMasterSc');
                    else alert('마스터 인자 추가는 검색을 통해 이루어집니다. (향후 구현)');
                } else if (e.target.matches('[data-action="addCustom"]')) {
                    const activeTab = DB.user.userSettings.lastCollectionTab;
                    if(activeTab === 'sc') renderCollectionView('addCustomSc');
                    else renderCollectionView('addCustomInza');
                }
            });
            container.querySelector('.collection-list')?.addEventListener('click', e => {
                if (e.target.matches('.delete-btn')) handleDeleteCollectionItem(e.target);
            });
        } else if (viewName.startsWith('add')) {
            const form = container.querySelector('form');
            form.addEventListener('submit', e => {
                e.preventDefault();
                if (viewName === 'addMasterSc') handleSaveMasterSc(form);
                if (viewName === 'addCustomSc') handleSaveCustomSc(form);
                if (viewName === 'addCustomInza') handleSaveCustomInza(form);
            });
            container.querySelector('[data-action="cancel"]').addEventListener('click', () => {
                 renderCollectionView('main', { activeTab: DB.user.userSettings.lastCollectionTab });
            });
        }
    }
    
    function handleSaveMasterSc(form) {
        const masterCardId = form.querySelector('#master-sc-select').value;
        const level = parseInt(form.querySelector('#master-sc-level').value, 10);
        
        const masterCard = DB.master.supportCards.find(c => c.masterCardId === masterCardId);
        if(!masterCard) { alert('유효하지 않은 마스터 카드입니다.'); return; }

        const newCard = {
            userCardId: `user_sc_${Date.now()}`,
            masterCardId: masterCard.masterCardId,
            name: masterCard.name,
            level: level,
        };
        DB.user.myCollection.supportCards.push(newCard);
        saveUserData();
        populateSelectors();
        renderCollectionView('main', { activeTab: 'sc' });
    }
    
    function getOrCreateSkillId(skillName) {
        const trimmedName = skillName.trim();
        if (!trimmedName) return null;

        const existingSkill = DB.master.skills.find(s => s.name === trimmedName) ||
                              (DB.user.customData.skills || []).find(s => s.name === trimmedName);
        if (existingSkill) return existingSkill.skillId;
        
        const newSkillId = `custom_s_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newSkill = { skillId: newSkillId, name: trimmedName, category: "common", isCustom: true };
        DB.user.customData.skills.push(newSkill);
        console.log(`신규 커스텀 스킬 생성: ${trimmedName} (ID: ${newSkillId})`);
        return newSkillId;
    }

    function handleSaveCustomSc(form) {
        const name = form.querySelector('#custom-sc-name').value.trim();
        if (!name) { alert('카드 이름을 입력해주세요.'); return; }
        
        const hintLevel = parseInt(form.querySelector('#custom-sc-hint-level').value, 10);
        const hintSkillsText = form.querySelector('#custom-sc-hint-skills').value;
        const eventSkillsText = form.querySelector('#custom-sc-event-skills').value;

        const hintSkillIds = hintSkillsText.split('\n').map(getOrCreateSkillId).filter(Boolean);
        const eventSkillIds = eventSkillsText.split('\n').map(getOrCreateSkillId).filter(Boolean);

        const masterCardId = `custom_sc_${Date.now()}`;
        const newMasterCard = {
            masterCardId: masterCardId,
            name: name,
            hintLevel: hintLevel,
            hintSkills: hintSkillIds,
            eventSkills: eventSkillIds,
            isCustom: true,
        };
        DB.user.customData.supportCards.push(newMasterCard);

        const newUserCard = {
            userCardId: `user_sc_${Date.now()}`,
            masterCardId: masterCardId,
            name: name,
            level: 4, // 커스텀은 기본 풀돌
            hintLevel: hintLevel // 커스텀은 고정 힌트레벨
        };
        DB.user.myCollection.supportCards.push(newUserCard);
        
        saveUserData();
        populateSelectors();
        renderCollectionView('main', { activeTab: 'sc' });
    }
    
    function handleSaveCustomInza(form) {
        const setName = form.querySelector('#custom-inza-set-name').value.trim();
        if (!setName) { alert('인자 세트 이름을 입력해주세요.'); return; }

        const masterInzaId = `custom_inza_${Date.now()}`;
        const slots = ['parent', 'grandparent1', 'grandparent2'];
        const newSlots = {};

        slots.forEach(slotId => {
            const charName = form.querySelector(`#inza-char-name-${slotId}`).value.trim();
            const skillFactors = form.querySelector(`#inza-skills-${slotId}`).value.split('\n').map(getOrCreateSkillId).filter(Boolean);
            if (charName || skillFactors.length > 0) {
                 newSlots[slotId] = { name: charName, skillFactors };
            }
        });
        
        const newMasterInza = { masterInzaId, name: setName, slots: newSlots, isCustom: true };
        DB.user.customData.inzaCharacters.push(newMasterInza);
        
        const newUserInza = { userInzaId: `user_inza_${Date.now()}`, masterInzaId, name: setName };
        DB.user.myCollection.inzaCharacters.push(newUserInza);

        saveUserData();
        populateSelectors();
        renderCollectionView('main', { activeTab: 'inza' });
    }
    
    function handleDeleteCollectionItem(btn) {
        const itemEl = btn.closest('.collection-item');
        const id = itemEl.dataset.id;
        const type = itemEl.dataset.type;

        if (confirm('정말로 이 항목을 컬렉션에서 삭제하시겠습니까?')) {
            if (type === 'sc') {
                DB.user.myCollection.supportCards = (DB.user.myCollection.supportCards || []).filter(c => c.userCardId !== id);
            } else if (type === 'inza') {
                DB.user.myCollection.inzaCharacters = (DB.user.myCollection.inzaCharacters || []).filter(i => i.userInzaId !== id);
            }
            saveUserData();
            populateSelectors();
            renderCollectionView('main', { activeTab: type });
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
                if (jsonData.myCollection && jsonData.userSettings && jsonData.version) {
                    applyUserData(jsonData);
                    saveUserData();
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
        if (!DB.master) return;

        try {
            const userData = loadUserData();
            applyUserData(userData);
        } catch (error) {
            return;
        }
        
        renderAll();
        applyDetailsVisibility(DB.user.userSettings.showDetails);

        themeToggle.addEventListener('click', toggleTheme);
        document.querySelector('.deck-slots-grid').addEventListener('change', handleDeckChange);
        resetSkillsBtn.addEventListener('click', handleResetClick);
        hideAcquiredToggle.addEventListener('change', e => { DB.user.userSettings.hideAcquired = e.target.checked; renderAll(); saveUserData(); });
        showDetailsToggle.addEventListener('change', e => { DB.user.userSettings.showDetails = e.target.checked; applyDetailsVisibility(e.target.checked); saveUserData(); });
        downloadBtn.addEventListener('click', () => { const dataStr = JSON.stringify(DB.user, null, 2); const blob = new Blob([dataStr], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'uma-skill-userdata.json'; a.click(); URL.revokeObjectURL(url); });
        uploadBtn.addEventListener('click', () => uploadInput.click());
        uploadInput.addEventListener('change', handleUploadChange);
        resetDataBtn.addEventListener('click', handleResetDataClick);
        skillListContainer.addEventListener('click', handleCheckboxClick);
        acquiredSkillsContainer.addEventListener('click', handleCheckboxClick);
        
        manageCollectionBtn.addEventListener('click', () => {
            renderCollectionView('main', { activeTab: DB.user.userSettings.lastCollectionTab || 'sc' });
            collectionModal.style.display = 'flex';
        });
        collectionModal.querySelector('.modal-close-btn').addEventListener('click', () => collectionModal.style.display = 'none');
        
        // Target Modal (기존과 유사하게 설정)
        openTargetModalBtn.addEventListener('click', () => targetModal.style.display = 'flex');
        targetModal.querySelector('.modal-close-btn').addEventListener('click', () => targetModal.style.display = 'none');
    }

    initialize();
});