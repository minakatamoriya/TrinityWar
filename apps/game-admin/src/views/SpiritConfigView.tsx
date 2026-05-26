import { ConfigCrudView } from '../components/ConfigCrudView';
import { ConfigEditorPanel } from '../components/ConfigForm';
import { Modal } from '../components/Modal';
import { spiritConfigFields } from '../domain/config';
import type { ConfigViewProps } from '../types';

export function SpiritConfigView(props: ConfigViewProps): JSX.Element {
  return (
    <>
      <ConfigCrudView
        {...props}
        fields={spiritConfigFields}
        idKey="spiritId"
        title="灵宠定义"
        useModalEditor
        columns={[
          { label: '灵宠 ID', key: 'spiritId' },
          { label: '名称', key: 'label' },
          { label: '稀有度', key: 'rarity' },
          { label: '阵营', key: 'factionAffinity' },
          { label: '定位', key: 'role' },
          { label: '基础攻', key: 'baseAttack' },
          { label: '基础生命', key: 'baseHp' },
          { label: '排序', key: 'sortOrder' },
        ]}
      />
      {props.isEditorOpen ? (
        <Modal
          title={props.editingId ? '编辑灵宠定义' : '新增灵宠定义'}
          subtitle={props.editingId || 'spirit config'}
          onClose={props.onCancelEdit}
        >
          <ConfigEditorPanel
            busy={props.busy}
            fields={spiritConfigFields}
            form={props.form}
            idKey="spiritId"
            isEditing={Boolean(props.editingId)}
            onCancel={props.onCancelEdit}
            onFieldChange={props.onFieldChange}
            onSave={props.onSave}
          />
        </Modal>
      ) : null}
    </>
  );
}
