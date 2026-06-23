import { useState } from 'react';
import type { ClientSeasonMedalCabinet } from '@trinitywar/shared';
import { FullScreenToolShell } from '../ui/common/ModalShell';
import { SeasonMedalCabinetView } from '../ui/common/SeasonMedalCabinetView';

type ProfileTabKey = 'account' | 'avatar' | 'honor';

interface ProfileModalProps {
  avatarInitial: string;
  currentSeasonEndsAt: string | null;
  devLoginModeLabel: string;
  medalCabinet: ClientSeasonMedalCabinet | null;
  nickname: string;
  open: boolean;
  pendingActionKey: string | null;
  seasonTimingOverrideActive: boolean;
  onClose: () => void;
  onResetSeasonTiming: () => void;
  onSetSeasonNearRollover: () => void;
  onSwitchDevUser: () => void;
}

export function ProfileModal(props: ProfileModalProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('account');

  if (!props.open) {
    return null;
  }

  const medalCount = props.medalCabinet?.medals.filter((medal) => medal.rewardStatus !== 'voided').length ?? 0;

  return (
    <FullScreenToolShell
      ariaLabel="玩家中心"
      bodyClassName="profile-dialog-body"
      className="profile-screen"
      eyebrow="个人资料"
      onBack={props.onClose}
      title={props.nickname}
    >
      <div className="profile-tab-row" role="tablist" aria-label="玩家中心">
        <button className={`tab-button ${activeTab === 'account' ? 'active' : ''}`} onClick={() => setActiveTab('account')} type="button">账号</button>
        <button className={`tab-button ${activeTab === 'avatar' ? 'active' : ''}`} onClick={() => setActiveTab('avatar')} type="button">头像</button>
        <button className={`tab-button ${activeTab === 'honor' ? 'active' : ''}`} onClick={() => setActiveTab('honor')} type="button">荣誉</button>
      </div>

      {activeTab === 'account' ? (
        <div className="profile-tab-panel">
          <div className="profile-summary">
            <button className="profile-avatar-large" type="button" aria-label="当前头像占位">
              {props.avatarInitial}
            </button>
            <div>
              <strong>{props.nickname}</strong>
              <p className="profile-modal-note">昵称修改暂未开放，后续会在这里维护玩家展示信息。</p>
            </div>
          </div>

          <div className="settings-row">
            <span>当前账号</span>
            <strong>{props.nickname}</strong>
          </div>
          <div className="settings-row">
            <span>测试身份</span>
            <strong>{props.devLoginModeLabel}</strong>
          </div>
          <div className="settings-row">
            <span>登录方式</span>
            <strong>开发测试登录</strong>
          </div>
          <div className="settings-row">
            <span>赛季结束</span>
            <strong>{props.currentSeasonEndsAt ?? '未知'}</strong>
          </div>
          <div className="settings-row">
            <span>调试时钟</span>
            <strong>{props.seasonTimingOverrideActive ? '已开启' : '未开启'}</strong>
          </div>

          <div className="settings-action-stack profile-settings-actions">
            <button
              className="secondary-button"
              disabled={props.pendingActionKey === 'system:season-near-rollover'}
              onClick={props.onSetSeasonNearRollover}
              type="button"
            >
              {props.pendingActionKey === 'system:season-near-rollover' ? '设置中...' : '设置为 60 秒后跨赛季'}
            </button>
            <button
              className="ghost-button"
              disabled={props.pendingActionKey === 'system:season-reset-timing'}
              onClick={props.onResetSeasonTiming}
              type="button"
            >
              {props.pendingActionKey === 'system:season-reset-timing' ? '恢复中...' : '恢复正常赛季时间'}
            </button>
            <button className="ghost-button" onClick={props.onSwitchDevUser} type="button">
              切换测试账号
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'avatar' ? (
        <div className="profile-tab-panel">
          <div className="profile-summary">
            <button className="profile-avatar-large" type="button" aria-label="当前头像占位">
              {props.avatarInitial}
            </button>
            <div>
              <strong>当前头像</strong>
              <p className="profile-modal-note">换头像功能暂不实现，后续会在这里接入头像库或微信头像授权。</p>
            </div>
          </div>
          <div className="profile-edit-placeholder">
            <button className="secondary-button small" type="button" disabled>更换头像</button>
            <button className="secondary-button small" type="button" disabled>使用微信头像</button>
          </div>
        </div>
      ) : null}

      {activeTab === 'honor' ? (
        <div className="profile-tab-panel profile-medal-section">
          <div className="profile-section-head">
            <h4>{props.medalCabinet?.currentSeasonTitle ?? '赛季奖章陈列柜'}</h4>
            <span>{medalCount} 枚</span>
          </div>
          {props.medalCabinet ? (
            <SeasonMedalCabinetView cabinet={props.medalCabinet} />
          ) : (
            <p className="profile-empty-text">正在读取奖章陈列柜。</p>
          )}
        </div>
      ) : null}
    </FullScreenToolShell>
  );
}
